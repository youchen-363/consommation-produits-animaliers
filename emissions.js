"use strict";

const initialiserEmissions = async () => {
  const categories = [
    { id: "bovine", nom: "Bovine", icone: "cow-svgrepo-com.svg" },
    { id: "porcine", nom: "Porcine", icone: "pig-svgrepo-com.svg" },
    { id: "volaille", nom: "Volaille", icone: "chicken-svgrepo-com.svg" },
    { id: "ovine-caprine", nom: "Ovine et caprine", icone: "sheep-svgrepo-com.svg" }
  ];
  const unites = {
    intensite_kg_co2e_par_kg: "kg CO₂e par kilo de viande",
    emissions_kt_co2e: "kt CO₂e",
    production_t: "t"
  };
  const indicateurs = Object.keys(unites);

  const vue = document.getElementById("emissions");
  const conteneur = document.getElementById("graphique-emissions");
  const infobulle = document.getElementById("infobulle-emissions");
  const filtreCategories = document.getElementById("categories-emissions");
  const selecteurIndicateur = document.getElementById("emissions-indicateur");
  const sliderAnnee = document.getElementById("emissions-slider");
  const curseurAnnee = document.getElementById("emissions-annee");
  const details = document.getElementById("details-emissions");
  const titrePays = document.getElementById("titre-pays-emissions");
  const courbe = document.getElementById("courbe-emissions");
  const camembert = document.getElementById("camembert-emissions");
  const legendeCamembert = document.getElementById("legende-camembert-emissions");
  const noteCamembert = document.getElementById("note-camembert-emissions");
  const comparaisons = document.getElementById("comparaisons-emissions");

  const { locale, maximumFractionDigits } = formatNombre.resolvedOptions();
  const plurielTours = new Intl.PluralRules(locale, { maximumFractionDigits });
  const longueurTourDuMondeKm = 40000;
  const equivalences = [
    { id: "heures-voiture-emissions", kgParKm: 2.7 * (6 / 100), kmParHeure: 80, idTours: "tours-voiture-emissions" },
    { id: "heures-avion-emissions", kgParKm: 0.2, kmParHeure: 540, idTours: "tours-avion-emissions" },
    { id: "heures-chauffage-emissions", kgParHeure: 0.215 * 5 }
  ];

  if (typeof d3 === "undefined" || typeof topojson === "undefined") {
    conteneur.textContent = "D3 ou topojson n'a pas pu être chargé.";
    return;
  }

  let monde;
  try {
    monde = await chargerFondCarteMonde();
  } catch (erreur) {
    conteneur.textContent = "Impossible de charger le fond de carte.";
    console.error(erreur);
    return;
  }

  let lignes;
  try {
    lignes = await chargerDonneesEmissions(indicateurs);
  } catch (erreur) {
    conteneur.textContent = "Impossible de charger les données d'émissions (data/emissions_viande.csv).";
    console.error(erreur);
    return;
  }

  const countries = topojson.feature(monde, monde.objects.countries);
  const countrymesh = topojson.mesh(monde, monde.objects.countries, (a, b) => a !== b);
  const codePays = (d) => d.id == null ? undefined : String(d.id).padStart(3, "0");
  const donneesParPays = d3.index(lignes, (d) => d.codePays, (d) => d.categorie, (d) => d.annee);
  const [premiereAnnee, derniereAnnee] = d3.extent(lignes, (d) => d.annee);
  const annees = d3.range(premiereAnnee, derniereAnnee + 1);

  const width = 928;
  const hauteurLegende = 60;
  const margeCarte = 2;

  // La projection de Miller garde un cadre rectangulaire et réduit l'étirement horizontal
  const projection = d3
    .geoProjection((lambda, phi) => {
      const [, y] = d3.geoMercatorRaw(lambda, phi * 0.8);
      return [lambda, y / 0.8];
    })
    .scale((width - 2 * margeCarte) / (2 * Math.PI))
    .translate([width / 2, 0]);

  // on coupe les poles
  const nord = projection([0, 80])[1];
  const sud = projection([0, -60])[1];
  const height = sud - nord + 2 * margeCarte;
  projection
    .translate([width / 2, margeCarte - nord])
    .clipExtent([[margeCarte, margeCarte], [width - margeCarte, height - margeCarte]]);
  const path = d3.geoPath(projection);
  const paysVisibles = countries.features.filter((d) => path(d) !== null);
  const codesPaysCarte = new Set(paysVisibles.map(codePays));

  // L'échelle reste fixe dans le temps pour chaque combinaison de viande et d'indicateur,
  // sinon ca n'aurait pas d'interet, il y aurait forcement toujours un pays rouge foncé 
  const echellesParCategorie = d3
    .rollup(
      lignes.filter((d) => codesPaysCarte.has(d.codePays)),
      (groupe) => Object.fromEntries(indicateurs.map((id) => {
        const lireValeur = (d) => d.mesures[id];
        const maximum = d3.max(groupe, lireValeur);
        let borne = maximum;
        if (id === "intensite_kg_co2e_par_kg") {
          // Le 95e percentile est la valeur sous laquelle se trouvent environ 95% des mesures
          // nice(4) arrondit la borne pour la légende, par exemple de 142,1 à 150, et
          // Math.min évite que cet arrondi dépasse le maximum réel. Si le percentile
          // est nul ou absent, le maximum reste la borne du dégradé.
          // Au dessus de la borne, les pays prennent le rouge le plus foncé. Ca évite d'avoir un pays qui atteint
          // un extrême tel que les autres pays sont tous jaunes comme s'ils n'avaient rien à se reprocher
          const percentile = d3.quantile(groupe, 0.95, lireValeur);
          if (percentile > 0) {
            borne = Math.min(maximum, d3.scaleLinear().domain([0, percentile]).nice(4).domain()[1]);
          }
        }
        return [id, { borne, plafonnee: borne < maximum }];
      })),
      (d) => d.categorie
    );
  let categorieChoisie = categories[0];
  let paysChoisi;

  function dessinerCourbe(serie, annee, indicateur, nomIndicateur) {
    const unite = unites[indicateur];
    const categorie = categorieChoisie.nom.toLowerCase();
    const valeurAnnee = document.getElementById("valeur-annee-emissions");
    const observations = annees.map((annee) => ({
      annee,
      valeur: serie?.get(annee)?.mesures[indicateur]
    }));
    const points = observations.filter((d) => d.valeur !== undefined);
    const valeur = serie?.get(annee)?.mesures[indicateur];
    document.getElementById("titre-evolution-emissions").textContent = `Évolution de la catégorie ${categorie}`;
    document.getElementById("message-courbe-emissions").hidden = Boolean(paysChoisi);
    valeurAnnee.hidden = !paysChoisi;
    valeurAnnee.textContent = valeur === undefined
      ? `${nomIndicateur} en ${annee}, donnée non renseignée`
      : `${nomIndicateur} en ${annee}, ${formaterNombreSelonValeur(valeur)} ${unite}`;

    if (paysChoisi && !points.length) {
      courbe.textContent = "Aucune donnée sur la période.";
      return;
    }

    const largeur = 500;
    const hauteur = 220;
    const gauche = 66;
    const droite = largeur - 23;
    const haut = 14;
    const bas = hauteur - 30;
    const x = d3
      .scaleLinear()
      .domain([premiereAnnee, Math.max(premiereAnnee + 1, derniereAnnee)])
      .range([gauche, droite]);

    const svg = d3
      .create("svg")
      .attr("viewBox", [0, 0, largeur, hauteur]);

    svg
      .append("g")
      .attr("transform", `translate(0, ${bas})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format("d")));

    if (!paysChoisi) {
      svg
        .attr("aria-hidden", "true")
        .append("line")
        .attr("class", "domain")
        .attr("x1", gauche)
        .attr("x2", gauche)
        .attr("y1", haut)
        .attr("y2", bas);
      courbe.replaceChildren(svg.node());
      return;
    }

    const [minimum, maximum] = d3.extent(points, (d) => d.valeur);
    const borneHaute = minimum === 0 && maximum === 0 ? 1 : Math.max(0, maximum);
    const y = d3
      .scaleLinear()
      .domain([Math.min(0, minimum), borneHaute])
      .nice(4)
      .range([bas, haut]);
    const pas = d3.tickStep(...y.domain(), 4);
    let facteur = 1;
    let suffixe = "";
    
    if (pas < 0.1) {
      const exposant = Math.floor(Math.log10(pas));
      facteur = 10 ** exposant;
      suffixe = `E${exposant}`;
    } else if (pas >= 1_000_000) {
      facteur = 1_000_000;
      suffixe = " M";
    } else if (pas >= 1_000) {
      facteur = 1_000;
      suffixe = " k";
    }
    const formaterGraduation = (valeur) => valeur === 0 ? "0" : formaterNombreSelonValeur(valeur / facteur) + suffixe;

    svg.attr("role", "img")
      .attr("aria-label", `${nomIndicateur} pour la catégorie ${categorie}, de ${premiereAnnee} à ${derniereAnnee}, en ${unite}`);

    svg.append("g")
      .attr("class", "emissions-grille")
      .attr("transform", `translate(${gauche}, 0)`)
      .call(d3.axisLeft(y).ticks(4).tickSize(gauche - droite).tickPadding(8).tickFormat(formaterGraduation));

    svg.append("line")
      .attr("class", "emissions-annee-repere")
      .attr("x1", x(annee))
      .attr("x2", x(annee))
      .attr("y1", haut)
      .attr("y2", bas);

    const couleur = COULEURS_VIANDES[categorieChoisie.id];
    svg.append("path")
      .datum(observations)
      .attr("fill", "none")
      .attr("stroke", couleur)
      .attr("stroke-width", 2)
      .attr("d", d3.line().defined((d) => d.valeur !== undefined).x((d) => x(d.annee)).y((d) => y(d.valeur)));

    svg.selectAll("circle")
      .data(points)
      .join("circle")
      .attr("cx", (d) => x(d.annee))
      .attr("cy", (d) => y(d.valeur))
      .attr("r", (d) => d.annee === annee ? 5 : 2.4)
      .attr("fill", (d) => d.annee === annee ? "var(--ink)" : couleur)
      .append("title")
      .text((d) => `${d.annee}, ${formaterNombreSelonValeur(d.valeur)} ${unite}`);

    courbe.replaceChildren(svg.node());
  }

  function dessinerCamembert(series, annee, indicateur, nomIndicateur) {
    const valeurs = categories.map((categorie) => ({
      ...categorie,
      valeur: series?.get(categorie.id)?.get(annee)?.mesures[indicateur]
    }));
    const positives = valeurs.filter((d) => d.valeur > 0);
    const total = d3.sum(positives, (d) => d.valeur);

    document.getElementById("titre-repartition-emissions").textContent = indicateur === "intensite_kg_co2e_par_kg"
      ? "Émissions pour produire 1 kg par catégorie renseignée"
      : `${nomIndicateur} en ${annee}`;

    camembert.hidden = !total;
    camembert.replaceChildren();
    if (total) {
      const svg = d3.create("svg").attr("viewBox", [-82, -82, 164, 164]);
      const secteurs = d3.pie().sort(null).value((d) => d.valeur)(positives);
      svg.selectAll("path")
        .data(secteurs)
        .join("path")
        .attr("d", d3.arc().innerRadius(0).outerRadius(80))
        .attr("fill", (d) => COULEURS_VIANDES[d.data.id])
        .attr("stroke", "white")
        .attr("stroke-width", 1);
      camembert.append(svg.node());
    }

    const liste = d3.select(legendeCamembert).selectAll("li").data(valeurs, (d) => d.id).join("li");
    liste.classed("emissions-categorie-active", (d) => d.id === categorieChoisie.id);
    liste
      .selectAll(".emissions-pastille")
      .data((d) => [d])
      .join("span")
      .attr("class", "emissions-pastille")
      .attr("aria-hidden", "true")
      .style("background-color", (d) => COULEURS_VIANDES[d.id]);
    liste
      .selectAll(".emissions-nom-categorie")
      .data((d) => [d])
      .join("strong")
      .attr("class", "emissions-nom-categorie")
      .text((d) => d.nom);
    liste
      .selectAll(".emissions-valeur-categorie")
      .data((d) => [d])
      .join("span")
      .attr("class", "emissions-valeur-categorie")
      .text((d) => {
        if (d.valeur === undefined) return "Non renseignée";
        const mesure = `${formaterNombreSelonValeur(d.valeur)} ${unites[indicateur]}`;
        if (!total || d.valeur < 0) return mesure;
        const part = 100 * d.valeur / total;
        return `${mesure}, ${part > 0 && part < 0.05 ? "< 0,1" : formaterNombreSelonValeur(part)} %`;
      });

    let note = "";
    if (!total) {
      note = "Aucune valeur positive pour tracer le camembert.";
    } else if (valeurs.some((d) => d.valeur < 0)) {
      note = "Les valeurs négatives figurent dans la légende. Les parts du camembert sont calculées sur les valeurs positives.";
    } else if (valeurs.some((d) => d.valeur === undefined) && indicateur !== "intensite_kg_co2e_par_kg") {
      note = "Les parts sont calculées sur les catégories renseignées.";
    }
    noteCamembert.textContent = note;
    noteCamembert.hidden = !note;
  }

  function formaterToursDuMonde(tours) {
    if (tours > 0 && tours < 0.1) {
      const part = tours * 100;
      const pourcentage = part < 0.05 ? "moins de 0,1" : formaterNombreSelonValeur(part);
      return `${pourcentage} % d'un tour du monde`;
    }
    const unite = plurielTours.select(tours) === "one" ? "tour" : "tours";
    return `${formaterNombreSelonValeur(tours)} ${unite} du monde`;
  }

  function afficherEquivalences(mesures, indicateur) {
    const base = document.getElementById("base-equivalences-emissions");
    base.hidden = false;
    const intensite = indicateur === "intensite_kg_co2e_par_kg";
    const volume = indicateur === "production_t";
    const valeur = mesures?.[indicateur];
    const emissions = intensite ? valeur : mesures?.emissions_kt_co2e;
    comparaisons.hidden = valeur === undefined || emissions === undefined || emissions < 0;
    if (comparaisons.hidden) {
      base.textContent = emissions < 0 && valeur !== undefined
        ? "La valeur d'émissions est négative. La comparaison en heures nécessite une valeur positive ou nulle."
        : "Les données sont insuffisantes pour calculer les équivalences.";
      return;
    }

    const libelle = volume ? `La production de ${formaterNombreSelonValeur(valeur)} t` : "La production annuelle";
    base.textContent = intensite
      ? `Produire 1 kg de cette viande représente ${formaterNombreSelonValeur(emissions)} kg CO₂e à la ferme.`
      : `${libelle} représente ${formaterNombreSelonValeur(emissions)} kt CO₂e à la ferme.`;

    const kg = intensite ? emissions : emissions * 1e6;
    for (const { id, kgParHeure, kgParKm, kmParHeure, idTours } of equivalences) {
      const heures = kg / (kgParHeure ?? kgParKm * kmParHeure);
      const duree = heures > 0 && heures < 1
        ? (heures < 1 / 60 ? "moins d'une minute" : `${formaterNombreSelonValeur(heures * 60)} min`)
        : `${formaterNombreSelonValeur(heures)} h`;
      document.getElementById(id).textContent = duree;
      if (idTours) {
        const tours = kg / kgParKm / longueurTourDuMondeKm;
        document.getElementById(idTours).textContent = formaterToursDuMonde(tours);
      }
    }
  }

  function afficherDetails(annee) {
    const indicateur = selecteurIndicateur.value;
    const nomIndicateur = selecteurIndicateur.selectedOptions[0].textContent;
    if (!paysChoisi) {
      dessinerCourbe(undefined, annee, indicateur, nomIndicateur);
      return;
    }

    const series = donneesParPays.get(codePays(paysChoisi));
    const serie = series?.get(categorieChoisie.id);
    titrePays.textContent = `${paysChoisi.properties.name} en ${annee}`;
    document.getElementById("message-camembert-emissions").hidden = true;
    document.getElementById("detail-camembert-emissions").hidden = false;
    dessinerCourbe(serie, annee, indicateur, nomIndicateur);
    dessinerCamembert(series, annee, indicateur, nomIndicateur);
    afficherEquivalences(serie?.get(annee)?.mesures, indicateur);
  }

  function initialiserFiltreCategories() {
    const listeCategories = filtreCategories.querySelector(".category-options");

    for (const categorie of categories) {
      const etiquette = document.createElement("label");
      const bouton = document.createElement("input");
      const icone = document.createElement("img");
      const texte = document.createElement("span");
      const nom = document.createElement("span");
      const traitCouleur = document.createElement("span");

      bouton.type = "radio";
      bouton.name = "categorie-emissions";
      bouton.value = categorie.id;
      bouton.checked = categorie === categorieChoisie;
      icone.className = "category-icon";
      icone.src = "assets/" + categorie.icone;
      icone.alt = "";
      texte.className = "category-text";
      nom.textContent = categorie.nom;
      traitCouleur.className = "series-key";
      traitCouleur.style.borderColor = COULEURS_VIANDES[categorie.id];

      texte.append(nom, traitCouleur);
      etiquette.append(bouton, icone, texte);
      listeCategories.append(etiquette);

      bouton.addEventListener("change", () => {
        categorieChoisie = categorie;
        dessinerCarte(Number(curseurAnnee.value));
      });
    }

    filtreCategories.disabled = false;
  }

  function masquerInfobulle() {
    infobulle.hidden = true;
  }

  function dessinerCarte(annee) {
    masquerInfobulle();
    const indicateur = selecteurIndicateur.value;
    const unite = unites[indicateur];
    const valeurPays = (d) => donneesParPays.get(codePays(d))?.get(categorieChoisie.id)?.get(annee)?.mesures[indicateur];
    const echelle = echellesParCategorie.get(categorieChoisie.id)?.[indicateur];
    const borne = echelle?.borne;
    const intensite = indicateur === "intensite_kg_co2e_par_kg";
    const couleur = d3.scaleSequential([0, borne || 1], d3.interpolateYlOrRd).clamp(true);

    const nomIndicateur = selecteurIndicateur.selectedOptions[0].textContent;
    const titreAnnee = `${nomIndicateur} en ${annee} — ${categorieChoisie.nom}`;

    function decrirePays(d) {
      const nom = d.properties.name;
      const valeur = valeurPays(d);
      return valeur === undefined
        ? `(${annee}) ${nom} : pas de données`
        : `(${annee}) ${nom} : ${formaterNombreSelonValeur(valeur)} ${unite}`;
    }

    const svg = d3
      .create("svg")
      .attr("viewBox", [0, 0, width, height + (borne === undefined ? 0 : hauteurLegende)])
      .attr("role", "group")
      .attr("aria-label", titreAnnee)
      .attr("style", "display: block; width: 100%; height: auto;");

    svg
      .append("path")
      .datum({ type: "Sphere" })
      .attr("fill", "white")
      .attr("stroke", "currentColor")
      .attr("d", path);

    const cheminsPays = svg
      .append("g")
      .selectAll("path")
      .data(paysVisibles)
      .join("path")
      .attr("class", "emissions-pays")
      .attr("role", "button")
      .attr("tabindex", 0)
      .attr("aria-label", decrirePays)
      .attr("aria-controls", details.id)
      .attr("aria-pressed", (d) => d === paysChoisi)
      .classed("emissions-pays-actif", (d) => d === paysChoisi)
      .attr("fill", (d) => (valeurPays(d) === undefined ? "var(--emissions-sans-donnees)" : couleur(valeurPays(d))))
      .attr("d", path)
      .on("pointerenter pointermove", (evenement, d) => {
        infobulle.textContent = decrirePays(d);
        infobulle.hidden = false;
        infobulle.style.left = Math.max(12, Math.min(evenement.clientX + 14, window.innerWidth - infobulle.offsetWidth - 12)) + "px";
        infobulle.style.top = Math.max(12, Math.min(evenement.clientY + 14, window.innerHeight - infobulle.offsetHeight - 12)) + "px";
      })
      .on("pointerleave", masquerInfobulle)
      .on("click", (_, pays) => selectionnerPays(pays))
      .on("keydown", (evenement, pays) => {
        if (evenement.key === "Enter" || evenement.key === " ") {
          evenement.preventDefault();
          selectionnerPays(pays);
        }
      });

    function selectionnerPays(pays) {
      paysChoisi = pays;
      masquerInfobulle();
      cheminsPays
        .classed("emissions-pays-actif", (d) => d === paysChoisi)
        .attr("aria-pressed", (d) => d === paysChoisi);
      afficherDetails(annee);
    }

    svg
      .append("path")
      .datum(countrymesh)
      .attr("class", "emissions-frontieres")
      .attr("fill", "none")
      .attr("pointer-events", "none")
      .attr("d", path);

    if (borne !== undefined) {
      const degrade = svg
        .append("defs")
        .append("linearGradient")
        .attr("id", "degrade-emissions");

      degrade
        .selectAll("stop")
        .data(d3.range(0, 1.01, 0.1))
        .join("stop")
        .attr("offset", (t) => t)
        .attr("stop-color", (t) => d3.interpolateYlOrRd(t));

      const largeurLegende = 300;
      const legende = svg
        .append("g")
        .attr("transform", `translate(${(width - largeurLegende) / 2}, ${height + 8})`);

      legende
        .append("rect")
        .attr("width", largeurLegende)
        .attr("height", 12)
        .attr("fill", "url(#degrade-emissions)");

      legende
        .append("text")
        .attr("y", 28)
        .attr("font-size", 13)
        .text("0");

      if (intensite && borne > 0) {
        legende
          .append("text")
          .attr("x", largeurLegende / 2)
          .attr("y", 28).attr("font-size", 13)
          .attr("text-anchor", "middle")
          .text(formaterNombreSelonValeur(borne / 2));
      }
      legende
        .append("text")
        .attr("x", largeurLegende)
        .attr("y", 28).attr("font-size", 13)
        .attr("text-anchor", "end")
        .text((echelle.plafonnee ? "> " : "") + formaterNombreSelonValeur(borne));

      legende
        .append("text")
        .attr("x", largeurLegende / 2)
        .attr("y", 46)
        .attr("font-size", 13)
        .attr("text-anchor", "middle")
        .text(unite);
    }

    conteneur.replaceChildren(svg.node());
    afficherDetails(annee);
  }

  const slider = initialiserSliderAnnee(sliderAnnee, {
    premiereAnnee,
    derniereAnnee,
    onChange: dessinerCarte,
    delai: 250
  });
  sliderAnnee.disabled = false;
  initialiserFiltreCategories();
  selecteurIndicateur.addEventListener("change", () => dessinerCarte(Number(curseurAnnee.value)));
  selecteurIndicateur.disabled = false;

  document.addEventListener("changement-vue", () => {
    if (vue.hidden) {
      slider.arreterLecture();
      masquerInfobulle();
    }
  });
  window.addEventListener("scroll", masquerInfobulle);
};

initialiserEmissions();
