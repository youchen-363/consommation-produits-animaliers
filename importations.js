"use strict";

const initialiserImportations = async () => {
  const vue = document.getElementById("importations");
  const conteneur = document.getElementById("graphique-importations");
  const infobulle = document.getElementById("infobulle-importations");
  const curseurAnnee = document.getElementById("import-annee");
  const texteAnnee = document.getElementById("import-periode");
  const barreAnnee = curseurAnnee.parentElement;

  // arrondit les taux à une décimale maximum, avec une virgule en français
  const formatTaux = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1
  });

  if (typeof d3 === "undefined") {
    conteneur.textContent = "D3 n'a pas pu être chargé, vérifiez que le dossier vendor est bien présent.";
    return;
  }

  // on attend la lecture du CSV avant de créer le curseur et le graphe
  let donnees;
  try {
    donnees = await chargerDonneesImportations();
  } catch (erreur) {
    conteneur.textContent = "Impossible de charger taux_importation.csv :(";
    console.error(erreur);
    return;
  }

  const annees = donnees.annees;
  const premiereAnnee = annees[0];
  const derniereAnnee = annees[annees.length - 1];

  // on affiche par défaut l'année la plus récente
  let anneeChoisie = derniereAnnee;

  // on creer le SVG une seule fois et on garde une hauteur fixe comme dans consommation.js
  const hauteur = 350;
  const svg = d3.select(conteneur).append("svg");

  function masquerInfobulle() {
    infobulle.hidden = true;
  }

  // ========================
  // === Tooltip au hover ===
  // ========================

  function afficherInfobulle(evenement, observation) {
    infobulle.textContent = `(${observation.annee}) ${observation.nomCategorie} : ${formatTaux.format(observation.taux)} % de la viande consommée est importée`;
    infobulle.hidden = false;

    // empêche la bulle de sortir de la fenêtre, meme traitement que les autres graphes
    infobulle.style.left = Math.max(12, Math.min(evenement.clientX + 14, window.innerWidth - infobulle.offsetWidth - 12)) + "px";
    infobulle.style.top = Math.max(12, Math.min(evenement.clientY + 14, window.innerHeight - infobulle.offsetHeight - 12)) + "px";
  }

  // =============================
  // === Affichage de l'année ===
  // =============================

  function actualiserAnnee() {
    // les inputs renvoient des textes, Number les convertit en nombres
    anneeChoisie = Number(curseurAnnee.value);
    texteAnnee.value = String(anneeChoisie);

    // un seul curseur : la partie colorée de la piste va du début jusqu'à la poignée
    const dureeTotale = Math.max(1, derniereAnnee - premiereAnnee);
    barreAnnee.style.setProperty("--debut", "0%");
    barreAnnee.style.setProperty("--fin", 100 * (anneeChoisie - premiereAnnee) / dureeTotale + "%");
  }

  // =================================
  // === Dessin du graphe et axes ===
  // ================================

  function dessinerImportations() {
    masquerInfobulle();
    if (vue.hidden) {
      return;
    }

    // garde uniquement les barres de l'année choisie
    const selection = donnees.observations.filter((observation) => observation.annee === anneeChoisie);
    // mesure le SVG à l'intérieur du padding défini en CSS, comme dans consommation.js
    const largeur = svg.node().getBoundingClientRect().width;

    // une bande par viande, dans l'ordre défini dans data.js
    const x = d3
      .scaleBand()
      .domain(donnees.categories.map((categorie) => categorie.id))
      .range([0, largeur])
      .padding(0.3);

    // axe vertical fixe de 0 à 100 % pour pouvoir comparer les années entre elles
    const y = d3
      .scaleLinear()
      .domain([0, 100])
      .range([hauteur, 0]);

    // Même principe de viewBox que dans consommation.js, adapte le dessin à sa largeur
    svg.attr("viewBox", `0 0 ${largeur} ${hauteur}`);
    // efface uniquement le contenu du SVG pour pas scroll quand on change d'année
    svg.selectAll("*").remove();

    // lignes horizontales de la grille
    svg
      .append("g")
      .attr("class", "grid")
      .call(d3
        .axisLeft(y)
        .ticks(5)
        .tickSize(-largeur)
        .tickFormat("")
      );

    // taux à gauche
    svg
      .append("g")
      .call(d3
        .axisLeft(y)
        .ticks(5)
        .tickFormat((valeur) => formatTaux.format(valeur) + " %")
      );

    // noms des viandes en bas, en version courte si la bande d'une viande fait moins de 90px de large
    const nomsCourts = x.step() < 90;
    const nomsCategories = new Map(donnees.categories.map((categorie) => {
      return [categorie.id, nomsCourts && categorie.nomCourt ? categorie.nomCourt : categorie.nom];
    }));
    svg
      .append("g")
      .attr("transform", `translate(0, ${hauteur})`)
      .call(d3
        .axisBottom(x)
        .tickSize(0)
        .tickPadding(10)
        .tickFormat((id) => nomsCategories.get(id))
      );

    // Limite la largeur des barres à 120px pour pas avoir des blocs énormes sur grand écran
    const largeurBarre = Math.min(120, x.bandwidth());

    // join("rect") crée une barre par viande pour l'année choisie
    svg
      .selectAll(".barre")
      .data(selection)
      .join("rect")
      .attr("class", "barre")
      .attr("x", (observation) => x(observation.idCategorie) + (x.bandwidth() - largeurBarre) / 2)
      .attr("y", (observation) => y(observation.taux))
      .attr("width", largeurBarre)
      .attr("height", (observation) => hauteur - y(observation.taux))
      .attr("fill", (observation) => observation.couleur)
      .on("pointerenter pointermove", afficherInfobulle)
      .on("pointerleave", masquerInfobulle);

    // écrit la valeur au-dessus de chaque barre
    svg
      .selectAll(".valeur")
      .data(selection)
      .join("text")
      .attr("class", "valeur")
      .attr("text-anchor", "middle")
      .attr("x", (observation) => x(observation.idCategorie) + x.bandwidth() / 2)
      .attr("y", (observation) => y(observation.taux) - 6)
      .text((observation) => formatTaux.format(observation.taux) + " %");
  }

  // ============================
  // === Création du curseur ===
  // ============================

  // limite le curseur aux années disponibles, avec un pas d'un an
  curseurAnnee.min = premiereAnnee;
  curseurAnnee.max = derniereAnnee;
  curseurAnnee.step = 1;
  curseurAnnee.value = anneeChoisie;

  // 'input' se déclenche pendant le déplacement du slider
  curseurAnnee.addEventListener("input", () => {
    actualiserAnnee();
    dessinerImportations();
  });

  // ==============================
  // === Mise a jour du graphe ===
  // ==============================

  actualiserAnnee();

  document.addEventListener("changement-vue", dessinerImportations);
  window.addEventListener("resize", dessinerImportations);
  window.addEventListener("scroll", masquerInfobulle);
  dessinerImportations();
};

initialiserImportations();
