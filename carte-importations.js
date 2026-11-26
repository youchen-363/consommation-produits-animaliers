"use strict";

const initialiserCarteImportations = async () => {
  // Fait correspondre les noms du fond de carte aux libellés des données importées
  const PAYS = {
    "Germany": "Allemagne", 
    "Austria": "Autriche", 
    "Belgium": "Belgique", 
    "Bulgaria": "Bulgarie",
    "Cyprus": "Chypre", 
    "Croatia": "Croatie", 
    "Denmark": "Danemark",
    "Spain": "Espagne (y compris Canaries)", 
    "Estonia": "Estonie", 
    "Finland": "Finlande",
    "Greece": "Grèce", 
    "Hungary": "Hongrie", 
    "Ireland": "Irlande", 
    "Italy": "Italie",
    "Latvia": "Lettonie", 
    "Lithuania": "Lituanie", 
    "Luxembourg": "Luxembourg", 
    "Malta": "Malte",
    "Netherlands": "Pays-Bas", 
    "Poland": "Pologne", 
    "Portugal": "Portugal",
    "Czechia": "République tchèque", 
    "Czech Rep.": "République tchèque", 
    "Romania": "Roumanie",
    "Slovakia": "Slovaquie", 
    "Slovenia": "Slovénie", 
    "Sweden": "Suède", 
    "Algeria": "Algerie",
    "Saudi Arabia": "Arabie saoudite", 
    "Argentina": "Argentine", 
    "Australia": "Australie",
    "Benin": "Benin", 
    "Brazil": "Bresil", 
    "Canada": "Canada", 
    "Chile": "Chili", 
    "Congo": "Congo",
    "South Korea": "Coree Du Sud",
    "United States of America": "E.U.A.N",
    "Egypt": "Egypte",
    "United Arab Emirates": "Emirats Arabes Unis",
    "Gabon": "Gabon", 
    "Ghana": "Ghana",
    "Hong Kong": "Hong-kong",
    "Japan": "Japon",
    "Kuwait": "Koweit",
    "Morocco": "Maroc",
    "New Zealand": "Nouvelle-zelande",
    "Oman": "Oman",
    "Philippines": "Philippines",
    "Qatar": "Qatar",
    "Dem. Rep. Congo": "Republique Democratique Du Congo",
    "China": "Republique Populaire De Chine",
    "United Kingdom": "Royaume-uni",
    "Russia": "Russie",
    "Singapore": "Singapour",
    "Switzerland": "Suisse",
    "Thailand": "Thailande",
    "Togo": "Togo",
    "Ukraine": "Ukraine",
    "Uruguay": "Uruguay",
    "Vietnam": "Vietnam",
    "Yemen": "Yemen"
  };

  const conteneur = document.getElementById("carte-importations");
  const infobulle = document.getElementById("infobulle-importations");
  const curseurAnnee = document.getElementById("import-annee");
  const sliderAnnee = document.getElementById("import-slider");
  const formatPart = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

  let viande = null;
  let monde;
  let lignes;

  const normaliser = (texte) => String(texte ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^_+/, "")
    .replace(/\s+/g, " ")
    .trim();

  function typesViande(observation) {
    const nom = normaliser(observation.idCategorie + " " + observation.nomCategorie);

    if (/total|toutes|ensemble/.test(nom)) return ["total viandes"];
    if (/bovin|boeuf/.test(nom)) return ["viande bovine avec onglet et hampe"];
    if (/porc/.test(nom)) return ["viande porcine y compris graisse de porc"];
    if (/volaille|poulet/.test(nom)) return ["viande de volailles de chair (n.c. petites especes)"];

    const types = [];
    if (/ovin/.test(nom)) types.push("viande ovine");
    if (/caprin/.test(nom)) types.push("viande caprine");
    if (/equi|cheval|chevalin/.test(nom)) types.push("viande d'equides");
    return types;
  }

  async function chargerLignes() {
    const donnees = window.IMPORTATIONS_PAYS;

    return donnees.map((d) => ({
      annee: d.annee,
      pays: normaliser(d.pays),
      type: normaliser(d.type),
      valeur: d.valeur
    }));
  }

  function calculerParts(annee) {
    const types = new Set(typesViande(viande));
    const totaux = d3.rollup(
      lignes.filter((d) => d.annee === annee && types.has(d.type)),
      (groupe) => d3.sum(groupe, (d) => d.valeur),
      (d) => d.pays
    );
    const totalMonde = totaux.get("monde");

    if (!totalMonde) {
      return null;
    }

    return new Map(Array.from(totaux, ([pays, valeur]) => [pays, (100 * valeur) / totalMonde]));
  }

  function masquerInfobulle() {
    infobulle.hidden = true;
  }

  function dessinerCarte() {
    const annee = Number(curseurAnnee.value);
    const parts = viande ? calculerParts(annee) : null;
    const partPays = (d) => parts?.get(normaliser(PAYS[d.properties?.name]));

    const countries = topojson.feature(monde, monde.objects.countries);
    const countrymesh = topojson.mesh(monde, monde.objects.countries, (a, b) => a !== b);

    const titre = document.createElement("p");
    if (!viande) {
      titre.textContent = "Cliquez sur une barre pour voir d'où viennent les importations.";
    } else if (!parts) {
      titre.textContent = `Pas de données par pays : ${viande.nomCategorie} (${annee}).`;
    } else {
      titre.textContent = `${viande.nomCategorie} (${annee}) : part de chaque pays dans les importations françaises`;
    }

    const width = 928;
    const height = width / 2;
    const hauteurLegende = 40;

    const projection = d3
      .geoEqualEarth()
      .fitExtent([[2, 2], [width - 2, height - 2]], { type: "Sphere" });
    const path = d3.geoPath(projection);

    const maximum = d3.max(countries.features, partPays) || 1;
    const couleur = d3.scaleSequential([0, maximum], d3.interpolateYlOrRd);

    const svg = d3
      .create("svg")
      .attr("viewBox", [0, 0, width, height + (parts ? hauteurLegende : 0)])
      .attr("role", "img")
      .attr("aria-label", titre.textContent)
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
      .data(countries.features)
      .join("path")
      .attr("fill", (d) => (partPays(d) === undefined ? "#d1cece" : couleur(partPays(d))))
      .attr("stroke", "#666")
      .attr("stroke-width", 0.5)
      .attr("d", path)
      .on("pointerenter pointermove", (evenement, d) => {
        if (!parts) return;

        const nom = PAYS[d.properties.name] ?? d.properties.name;
        const part = partPays(d);
        infobulle.textContent = part === undefined
          ? `${nom} : pas de données`
          : `${nom} : ${formatPart.format(part)} % des importations`;
        infobulle.hidden = false;
        infobulle.style.left = Math.max(12, Math.min(evenement.clientX + 14, window.innerWidth - infobulle.offsetWidth - 12)) + "px";
        infobulle.style.top = Math.max(12, Math.min(evenement.clientY + 14, window.innerHeight - infobulle.offsetHeight - 12)) + "px";
      })
      .on("pointerleave", masquerInfobulle);

    svg
      .append("path")
      .datum(countrymesh)
      .attr("fill", "none")
      .attr("stroke", "white")
      .attr("pointer-events", "none")
      .attr("d", path);

    if (parts) {
      const degrade = svg.append("defs").append("linearGradient").attr("id", "degrade-importations");
      degrade
        .selectAll("stop")
        .data(d3.range(0, 1.01, 0.1))
        .join("stop")
        .attr("offset", (t) => t)
        .attr("stop-color", (t) => d3.interpolateYlOrRd(t));

      const legende = svg.append("g").attr("transform", `translate(${width / 2 - 100}, ${height + 8})`);
      legende.append("rect").attr("width", 200).attr("height", 12).attr("fill", "url(#degrade-importations)");
      legende.append("text").attr("y", 28).attr("font-size", 13).text("0 %");
      legende.append("text").attr("x", 200).attr("y", 28).attr("font-size", 13).attr("text-anchor", "end")
        .text(formatPart.format(maximum) + " %");
    }

    conteneur.replaceChildren(titre, svg.node());
  }

  if (typeof d3 === "undefined" || typeof topojson === "undefined") {
    conteneur.textContent = "D3 ou topojson n'a pas pu être chargé.";
    return;
  }

  try {
    monde = await chargerFondCarteMonde();
  } catch (erreur) {
    conteneur.textContent = "Impossible de charger le fond de carte.";
    console.error(erreur);
    return;
  }

  document.addEventListener("choix-viande", (evenement) => {
    viande = evenement.detail;
    if (lignes) dessinerCarte();
  });

  try {
    lignes = await chargerLignes();
  } catch (erreur) {
    conteneur.textContent = "Impossible de charger les données par pays (data/importations.js).";
    console.error(erreur);
    return;
  }

  sliderAnnee.addEventListener("changement-annee", () => {
    masquerInfobulle();
    dessinerCarte();
  });
  window.addEventListener("scroll", masquerInfobulle);

  dessinerCarte();
};

initialiserCarteImportations();