"use strict";

const initialiserPrixRevenus = async () => {
  const vue = document.getElementById("prix-revenus");
  const conteneur = document.getElementById("graphique-prix-revenus");
  const infobulle = document.getElementById("infobulle-prix");
  const debut = document.getElementById("prix-debut");
  const fin = document.getElementById("prix-fin");
  const curseur = debut.parentElement;

  // formate les nombres avec une virgule et un signe (+/-)
  const formatVariation = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
  const formatEcart = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2, signDisplay: "exceptZero" });

   if (typeof d3 === "undefined") {
    conteneurGraphique.textContent = "D3 n'a pas pu être chargé, vérifiez que le dossier vendor est bien présent.";
    return;
  }

  // on attend la lecture du CSV avant de créer les filtres et le graphe
  let donnees;
  try {
    donnees = await chargerDonneesEcartPrixRevenus();
  } catch (erreur) {
    conteneur.textContent = "Impossible de charger graph2.csv :(";
    console.error(erreur);
    return;
  }

  // on creer le SVG une seule fois et conserve sa hauteur. On réserve 20px par année et minimum 350px
  const hauteur = Math.max(350, donnees.length * 20);
  const svg = d3.select(conteneur).append("svg").attr("height", hauteur);

  function masquerInfobulle() {
    infobulle.hidden = true;
  }

  // ===============================
  // === Affichage de la période ===
  // ===============================

  function actualiserPeriode() {
    // les inputs renvoient des textes, Number les convertit en nombres
    const debutSelection = Number(debut.value);
    const finSelection = Number(fin.value);
    document.getElementById("prix-periode").value = donnees[debutSelection].annee + " à " + donnees[finSelection].annee;
    
    const duree = Math.max(1, donnees.length - 1);
    curseur.style.setProperty("--debut", 100 * debutSelection / duree + "%");
    curseur.style.setProperty("--fin", 100 * finSelection / duree + "%");
    curseur.classList.toggle("same-year", debutSelection === finSelection);
  }

  // =================================
  // === Dessin du graphe et axes ===
  // ================================

  function dessinerPrixRevenus() {
    masquerInfobulle();
    if (vue.hidden) {
      return;
    }

    // Garde les années de la période choisie
    const selection = donnees.slice(Number(debut.value), Number(fin.value) + 1);
    // Comme dans consommation.js, mesure le SVG à l'intérieur du padding défini en CSS.
    const largeur = svg.node().getBoundingClientRect().width;
    // on conserve la plus grosse amplitude des écarts positifs et négatifs pour notre axe des abscisses
    const maximum = d3.max(selection, (point) => Math.abs(point.ecart_points)) || 1;

    // on connait la chanson pour dessiner un graphe maintenant (consommation.js), donc je vais tout faire d'une traite
    // nice arrondit les bornes pour obtenir des graduations faciles à lire (entieres)
    const x = d3
      .scaleLinear()
      .domain([-maximum, maximum])
      .nice()
      .range([0, largeur]);

    // Ici les années sont sur l'axe vertical, scaleBand réserve une bande par année
    const y = d3
      .scaleBand()
      .domain(selection.map((point) => point.annee))
      .range([0, hauteur])
      .padding(0.25);

    // Même principe de viewBox que dans consommation.js, adapte le dessin à sa largeur
    svg.attr("viewBox", `0 0 ${largeur} ${hauteur}`);
    // efface uniquement le contenu du SVG, le SVG et sa hauteur restent en place pour pas scroll quand on change la période
    svg.selectAll("*").remove();

    // axisBottom trace des lignes verticales vers le haut et tickFormat masque leurs nombres sinon
    // ca chevauche les labels des écarts, c'est plus un hack qu'autre chose mais bon ca fait l'affaire 
    svg
      .append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0, ${hauteur})`)
      .call(d3
        .axisBottom(x)
        .ticks(largeur < 500 ? 4 : 8)
        .tickSize(-hauteur)
        .tickFormat("")
      );

    // place les années à gauche sans le petit trait de graduation
    svg
      .append("g")
      .attr("class", "annees")
      .call(d3
        .axisLeft(y)
        .tickSize(0)
        .tickPadding(10)
      );

    // place les écarts en bas et réduit le nombre de graduations sur les petits écrans
    svg
      .append("g")
      .attr("transform", `translate(0, ${hauteur})`)
      .call(d3
        .axisBottom(x)
        .ticks(largeur < 500 ? 4 : 8)
        .tickFormat((valeur) => formaterNombreSelonValeur(valeur, formatVariation.format))
      );

    // les barres négatives partent à gauche et les positives à droite
    svg
      .append("line")
      .attr("class", "zero")
      .attr("x1", x(0))
      .attr("x2", x(0))
      .attr("y1", 0)
      .attr("y2", hauteur);

    // Limite l'épaisseur des barres à 20px
    const hauteurBarre = Math.min(20, y.bandwidth());

    // Comme data(...).join("circle") dans consommation.js, associe une année à une forme SVG
    // Ici join("rect") crée un rectangle par année, et sa classe choisit la couleur selon le signe
    svg
      .selectAll(".barre")
      .data(selection)
      .join("rect")
      .attr("class", (point) => "barre " + (point.ecart_points > 0 ? "prix" : point.ecart_points < 0 ? "revenus" : "egalite"))
      // une barre négative commence à son écart parce que elle est dessinée a partir de sa gauche
      .attr("x", (point) => x(Math.min(0, point.ecart_points)))
      // centre le rectangle dans la bande réservée à son année
      .attr("y", (point) => y(point.annee) + (y.bandwidth() - hauteurBarre) / 2)
      // on garde au moins 1px pour rendre un écart nul visible (pour pouvoir le hover)
      .attr("width", (point) => Math.max(1, Math.abs(x(point.ecart_points) - x(0))))
      .attr("height", hauteurBarre)
      // tooltip au hover, meme traitement que consommation.js
      .on("pointerenter pointermove", (evenement, point) => {
        const prix = formaterNombreSelonValeur(point.variation_prix_pct, formatVariation.format);
        const revenu = formaterNombreSelonValeur(point.variation_revenu_nominal_uc_pct, formatVariation.format);
        const ecart = formaterNombreSelonValeur(point.ecart_points, formatEcart.format);
        infobulle.textContent = `(${point.annee}) Prix : ${prix}%, Revenu par UC : ${revenu}%, Écart : ${ecart}%`;
        infobulle.hidden = false;
        infobulle.style.left = Math.max(12, Math.min(evenement.clientX + 14, window.innerWidth - infobulle.offsetWidth - 12)) + "px";
        infobulle.style.top = Math.max(12, Math.min(evenement.clientY + 14, window.innerHeight - infobulle.offsetHeight - 12)) + "px";
      })
      .on("pointerleave", masquerInfobulle);
  }

  // ============================
  // === Création des filtres ===
  // ============================

  // Comme initialiserFiltrePeriode mais plus concis
  // TODO: Refactor ca dans un util, ca sera utile pour les prochains graphes aussi
  for (const poignee of [debut, fin]) {
    poignee.min = 0;
    poignee.max = donnees.length - 1;
    poignee.step = 1;
    poignee.value = poignee === debut ? 0 : donnees.length - 1;

    poignee.addEventListener("input", () => {
      if (poignee === debut) {
        debut.value = Math.min(Number(debut.value), Number(fin.value));
      } else {
        fin.value = Math.max(Number(debut.value), Number(fin.value));
      } 
      
      actualiserPeriode();
      dessinerPrixRevenus();
    });
  }

  // ==============================
  // === Mise a jour du graphe ===
  // ==============================

  actualiserPeriode();

  document.addEventListener("changement-vue", dessinerPrixRevenus);
  window.addEventListener("resize", dessinerPrixRevenus);
  window.addEventListener("scroll", masquerInfobulle);
  dessinerPrixRevenus();
};

initialiserPrixRevenus();
