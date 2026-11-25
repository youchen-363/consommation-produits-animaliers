"use strict";

const initialiserConsommation = async () => {
  const conteneurGraphique = document.getElementById("graphique-consommation");
  const infobulle = document.getElementById("infobulle");

  if (typeof d3 === "undefined") {
    conteneurGraphique.textContent = "D3 n'a pas pu être chargé, vérifiez que le dossier vendor est bien présent.";
    return;
  }

  // on attend la lecture du CSV avant de créer les filtres et le graphe
  let donnees;
  try {
    donnees = await chargerDonneesConsommation();
  } catch (erreur) {
    conteneurGraphique.textContent = "Impossible de charger graph1.csv :(";
    console.error(erreur);
    return;
  }

  const annees = donnees.annees;

  const iconesParCategorie = {
    bovine: "cow-svgrepo-com",
    porcine: "pig-svgrepo-com",
    volaille: "chicken-svgrepo-com",
    "ovine-caprine": "sheep-svgrepo-com"
  };

  // garde les catégories et la période choisies dans les filtres
  const filtres = {
    categoriesSelectionnees: ["bovine", "porcine", "volaille", "ovine-caprine", "autres"],
    anneeDebut: annees[0],
    anneeFin: annees[annees.length - 1]
  };

  // arrondit les nombres à une décimale maximum, avec une virgule en français
  const formatNombre = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1
  });

  // ============================
  // === Création des filtres ===
  // ============================

  function initialiserFiltreCategories() {
    const listeCategories = document.querySelector(".category-options");

    for (const categorie of donnees.consommation) {
      const etiquetteCategorie = document.createElement("label");
      const caseCategorie = document.createElement("input");
      const contenuEtiquette = document.createElement("span");
      const nomCategorie = document.createElement("span");
      const traitCouleur = document.createElement("span");

      caseCategorie.type = "checkbox";
      caseCategorie.value = categorie.id;
      caseCategorie.checked = filtres.categoriesSelectionnees.includes(categorie.id);

      traitCouleur.className = "series-key";
      traitCouleur.style.borderColor = categorie.couleur;

      contenuEtiquette.className = "category-text";
      nomCategorie.textContent = categorie.nom;
      contenuEtiquette.append(nomCategorie, traitCouleur);
      etiquetteCategorie.append(caseCategorie);

      // ajoute une icône si elle existe pour cette catégorie
      if (iconesParCategorie[categorie.id]) {
        const iconeCategorie = document.createElement("img");

        iconeCategorie.src = "assets/" + iconesParCategorie[categorie.id] + ".svg";
        iconeCategorie.alt = "";
        iconeCategorie.className = "category-icon";
        etiquetteCategorie.append(iconeCategorie);
      }

      etiquetteCategorie.append(contenuEtiquette);
      listeCategories.append(etiquetteCategorie);

      // récupère les cases encore cochées, puis redessine le graphe
      caseCategorie.addEventListener("change", () => {
        const casesCochees = listeCategories.querySelectorAll("input:checked");

        filtres.categoriesSelectionnees = Array.from(casesCochees, (caseCochee) => {
          return caseCochee.value;
        });

        dessinerConsommation();
      });
    }
  }

  function initialiserFiltrePeriode() {
    const curseurDebut = document.getElementById("conso-debut");
    const curseurFin = document.getElementById("conso-fin");
    const textePeriode = document.getElementById("conso-periode");
    const barrePeriode = curseurDebut.parentElement;
    const premiereAnnee = annees[0];
    const derniereAnnee = annees[annees.length - 1];

    // limite les deux curseurs aux années disponibles, avec un pas d'un an
    for (const curseur of [curseurDebut, curseurFin]) {
      curseur.min = premiereAnnee;
      curseur.max = derniereAnnee;
      curseur.step = 1;
    }

    curseurDebut.value = filtres.anneeDebut;
    curseurFin.value = filtres.anneeFin;

    const actualiserPeriode = () => {
      // les inputs renvoient des textes, Number les convertit en nombres
      filtres.anneeDebut = Number(curseurDebut.value);
      filtres.anneeFin = Number(curseurFin.value);
      textePeriode.value = curseurDebut.value + " à " + curseurFin.value;

      // transmet au CSS les limites de la partie colorée de la piste
      const dureeTotale = Math.max(1, derniereAnnee - premiereAnnee);
      const positionDebutPourcent = 100 * (filtres.anneeDebut - premiereAnnee) / dureeTotale;
      const positionFinPourcent = 100 * (filtres.anneeFin - premiereAnnee) / dureeTotale;

      barrePeriode.style.setProperty("--debut", positionDebutPourcent + "%");
      barrePeriode.style.setProperty("--fin", positionFinPourcent + "%");
      barrePeriode.classList.toggle("same-year", curseurDebut.value === curseurFin.value);
    };

    // 'input' se déclenche pendant le déplacement du slider alors que 'change' qu'à la fin
    curseurDebut.addEventListener("input", () => {
      curseurDebut.value = Math.min(Number(curseurDebut.value), Number(curseurFin.value));
      actualiserPeriode();
      dessinerConsommation();
    });

    curseurFin.addEventListener("input", () => {
      curseurFin.value = Math.max(Number(curseurFin.value), Number(curseurDebut.value));
      actualiserPeriode();
      dessinerConsommation();
    });

    actualiserPeriode();
  }

  // ========================
  // === Tooltip au hover ===
  // ========================

  function afficherInfobulle(evenement, observation) {
    const quantiteFormatee = formatNombre.format(observation.quantite);
    infobulle.textContent = `(${observation.annee}) ${observation.nomCategorie} : ${quantiteFormatee}kg équivalent-carcasse par habitant et par an`;
    infobulle.hidden = false;

    // récupère la position du point et celle de la souris dans la fenêtre pour calculerla position de la tooltip
    const rectanglePoint = evenement.currentTarget.getBoundingClientRect();
    const positionSourisHorizontale = evenement.clientX || rectanglePoint.left;
    const positionSourisVerticale = evenement.clientY || rectanglePoint.top;

    // empêche la bulle de sortir de la fenêtre
    const positionGaucheInfobulle = Math.min(
      positionSourisHorizontale + 14,
      window.innerWidth - infobulle.offsetWidth - 12
    );
    const positionHauteInfobulle = Math.min(
      positionSourisVerticale + 14,
      window.innerHeight - infobulle.offsetHeight - 12
    );

    infobulle.style.left = Math.max(12, positionGaucheInfobulle) + "px";
    infobulle.style.top = Math.max(12, positionHauteInfobulle) + "px";
  }

  function masquerInfobulle() {
    infobulle.hidden = true;
  }

  // =================================
  // === Dessin du graphe et axes ===
  // ================================

  function dessinerConsommation() {
    const categoriesAffichees = donnees.consommation.filter((categorie) => {
      return filtres.categoriesSelectionnees.includes(categorie.id);
    });

    masquerInfobulle();

    if (categoriesAffichees.length === 0) {
      conteneurGraphique.replaceChildren();
      const messageAucuneCategorie = document.createElement("p");

      messageAucuneCategorie.className = "empty-chart";
      messageAucuneCategorie.textContent = "Sélectionnez au moins une catégorie pour afficher le graphe";
      conteneurGraphique.append(messageAucuneCategorie);
      return;
    }

    // conserve le SVG et sa hauteur entre deux dessins, avant on faisait betement: conteneurGraphique.replaceChildren(), 
    // ce qui le supprimait de la page et scrollait en haut de la page a chaque changement de periode
    let svgGraphique = d3.select(conteneurGraphique).select("svg");

    if (svgGraphique.empty()) {
      conteneurGraphique.replaceChildren();
      svgGraphique = d3.select(conteneurGraphique).append("svg");
    }

    svgGraphique.selectAll("*").remove();

    const largeurGraphique = svgGraphique.node().getBoundingClientRect().width;
    const hauteurGraphique = 350;

    // Viewbox permet de créer un 'graphique' qui s'adapte a son conteneur: https://developer.mozilla.org/fr/docs/Web/SVG/Reference/Attribute/viewBox
    svgGraphique.attr("viewBox", `0 0 ${largeurGraphique} ${hauteurGraphique}`);

    // ajoute toutes les data de chaque categorie pour chaque année dans la période choisie
    // pour une catégorie donné, une valeur et son année ont le même index dans leurs tableaux respectifs
    const observations = [];
    for (const categorie of categoriesAffichees) {
      for (let indexAnnee = 0; indexAnnee < annees.length; indexAnnee++) {
        const annee = annees[indexAnnee];

        if (annee >= filtres.anneeDebut && annee <= filtres.anneeFin) {
          observations.push({
            annee: annee,
            quantite: categorie.valeurs[indexAnnee],
            idCategorie: categorie.id,
            nomCategorie: categorie.nom,
            couleur: categorie.couleur
          });
        }
      }
    }

    let domaineAnnees = [filtres.anneeDebut, filtres.anneeFin];
    if (filtres.anneeDebut === filtres.anneeFin) {
      // si les deux années sont pareils (donc une seule année), on ajoute une petite marge
      domaineAnnees = [filtres.anneeDebut - 0.5, filtres.anneeFin + 0.5];
    }

    // ces fonctions convertissent une année ou une quantité en position dans le SVG (https://d3js.org/d3-scale/linear)
    const positionAnnee = d3
      .scaleLinear()
      .domain(domaineAnnees)
      .range([0, largeurGraphique]);

    const quantiteMaximale = d3.max(observations, (observation) => {
      return observation.quantite;
    });

    const positionConsommation = d3
      .scaleLinear()
      .domain([0, quantiteMaximale])
      .nice()
      .range([hauteurGraphique, 0]);

    const dessinerAxes = () => {
      // Garde environ 100 pixels entre les années pour pas en avoir trop à l'écran
      const nombreGraduations = Math.max(1, Math.floor(largeurGraphique / 100));
      const pasGraduations = Math.max(
        1,
        Math.ceil((filtres.anneeFin - filtres.anneeDebut) / nombreGraduations)
      );

      const anneesGraduees = annees.filter((annee) => {
        return annee >= filtres.anneeDebut
          && annee <= filtres.anneeFin
          && (annee - filtres.anneeDebut) % pasGraduations === 0;
      });

      // IMPORTANT, sinon on voit pas la dernière année si elle tombe pas sur une graduation
      if (!anneesGraduees.includes(filtres.anneeFin)) {
        anneesGraduees.push(filtres.anneeFin);
      }

      // prolonge les lignes des ordonnées a gauche pour former la grille horizontale (https://d3js.org/d3-axis)
      svgGraphique
        .append("g")
        .attr("class", "grid")
        .call(
          d3.axisLeft(positionConsommation)
            .ticks(5)
            .tickSize(-largeurGraphique)
            .tickFormat("")
        );

      // ajoute les quantités à gauche
      svgGraphique
        .append("g")
        .call(d3.axisLeft(positionConsommation).ticks(5).tickFormat(d3.format("~g")));

      // place l'axe des années en bas
      svgGraphique
        .append("g")
        .attr("transform", `translate(0, ${hauteurGraphique})`)
        .call(d3.axisBottom(positionAnnee).tickValues(anneesGraduees).tickFormat(d3.format("d")));

      // place le titre du graphe
      svgGraphique
        .append("text")
        .attr("class", "axis-label")
        .attr("x", 20)
        .attr("y", 0)
        .text("kg équivalent-carcasse / habitant / an");
    };

    dessinerAxes();

    // prépare la ligne, x reçoit la position de l'année, y celle de la consommation
    // defined interrompt la courbe quand une quantité est absente: https://d3js.org/d3-shape/line#line_defined
    const genererCourbe = d3
      .line()
      .defined((observation) => observation.quantite !== null)
      .x((observation) => positionAnnee(observation.annee))
      .y((observation) => positionConsommation(observation.quantite));

    // datum donne la liste des points d'une catégorie à un seul chemin SVG (https://d3js.org/d3-selection/joining#selection_datum)
    for (const categorie of categoriesAffichees) {
      const observationsCategorie = observations.filter((observation) => {
        return observation.idCategorie === categorie.id;
      });

      svgGraphique
        .append("path")
        .datum(observationsCategorie)
        .attr("fill", "none")
        .attr("stroke", categorie.couleur)
        .attr("stroke-width", 3)
        .attr("d", genererCourbe);
    }

    // data associe chaque observation à un cercle, puis join crée ces cercles
    svgGraphique
      .selectAll("circle")
      .data(observations.filter((observation) => observation.quantite !== null))
      .join("circle")
      .attr("class", "data-point")
      .attr("cx", (observation) => positionAnnee(observation.annee))
      .attr("cy", (observation) => positionConsommation(observation.quantite))
      .attr("r", 5)
      .attr("fill", (observation) => observation.couleur)
      .on("pointerenter", afficherInfobulle)
      .on("pointerleave", masquerInfobulle);
  }

  // ==============================
  // === Mise a jour du graphe ===
  // ==============================

  function actualiserConsommation() {
    masquerInfobulle();

    if (!document.getElementById("consommation").hidden) {
      dessinerConsommation();
    }
  }

  initialiserFiltreCategories();
  initialiserFiltrePeriode();

  document.addEventListener("changement-vue", actualiserConsommation);
  window.addEventListener("resize", actualiserConsommation);
  window.addEventListener("scroll", masquerInfobulle);
  actualiserConsommation();
};

initialiserConsommation();
