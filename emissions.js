"use strict";

const initialiserEmissions = async () => {
  const categories = [
    { id: "bovine", nom: "Bovine", icone: "cow-svgrepo-com.svg" },
    { id: "porcine", nom: "Porcine", icone: "pig-svgrepo-com.svg" },
    { id: "volaille", nom: "Volaille", icone: "chicken-svgrepo-com.svg" },
    { id: "ovine-caprine", nom: "Ovine et caprine", icone: "sheep-svgrepo-com.svg" }
  ];
  const unites = {
    intensite_kg_co2e_par_kg: "kg CO₂e/kg",
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
  const donneesParCategorie = d3.index(lignes, (d) => d.categorie, (d) => d.annee, (d) => d.codePays);

  const width = 928;
  const hauteurLegende = 40;
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

  // L'échelle reste fixe dans le temps pour chaque combinaison de viande et d'indicateur
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
    const donnees = donneesParCategorie.get(categorieChoisie.id)?.get(annee);
    const valeurPays = (d) => donnees?.get(codePays(d))?.mesures[indicateur];
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
        : `(${annee}) ${nom} : ${formatNombre.format(valeur)} ${unite}`;
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

    svg
      .append("g")
      .selectAll("path")
      .data(paysVisibles)
      .join("path")
      .attr("class", "emissions-pays")
      .attr("role", "img")
      .attr("aria-label", decrirePays)
      .attr("fill", (d) => (valeurPays(d) === undefined ? "var(--emissions-sans-donnees)" : couleur(valeurPays(d))))
      .attr("d", path)
      .on("pointerenter pointermove", (evenement, d) => {
        infobulle.textContent = decrirePays(d);
        infobulle.hidden = false;
        infobulle.style.left = Math.max(12, Math.min(evenement.clientX + 14, window.innerWidth - infobulle.offsetWidth - 12)) + "px";
        infobulle.style.top = Math.max(12, Math.min(evenement.clientY + 14, window.innerHeight - infobulle.offsetHeight - 12)) + "px";
      })
      .on("pointerleave", masquerInfobulle)
      .on("click", () => {});

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
          .text(formatNombre.format(borne / 2));
      }
      legende
        .append("text")
        .attr("x", largeurLegende)
        .attr("y", 28).attr("font-size", 13)
        .attr("text-anchor", "end")
        .text((echelle.plafonnee ? "> " : "") + formatNombre.format(borne) + unite);
    }

    conteneur.replaceChildren(svg.node());
  }

  const [premiereAnnee, derniereAnnee] = d3.extent(lignes, (d) => d.annee);
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
