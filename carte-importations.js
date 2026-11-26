"use strict";

const initialiserCarteImportations = async () => {
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

  let viande = null;
  let monde;
  let lignes;
  const donneesParViande = new Map();

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
    const mappingImport = await fetch('./data/mapping_rules.json');
    const mappingRules = await mappingImport.json();
    const donnees = await d3.csv("./data/importation.csv", (ligne) => {
      return {
        annee: +ligne.annee,
        pays: normaliser(mappingRules.pays[ligne.pays]),
        type: normaliser(mappingRules.type[ligne.type]),
        valeur: +ligne.valeur
      };
    });
    return donnees;
  }

  function lirePartPays(parts, d) {
    const nom = PAYS[d.properties?.name];
    return nom ? parts?.get(normaliser(nom)) : undefined;
  }

  function calculerDonneesViande(observation, paysCarte) {
    const id = observation.idCategorie;
    if (donneesParViande.has(id)) {
      return donneesParViande.get(id);
    }

    const types = new Set(typesViande(observation));
    const totauxParAnnee = d3.rollup(
      lignes.filter((d) => types.has(d.type)),
      (groupe) => d3.sum(groupe, (d) => d.valeur),
      (d) => d.annee,
      (d) => d.pays
    );
    const partsParAnnee = new Map();

    for (const [annee, totaux] of totauxParAnnee) {
      const totalMonde = totaux.get("monde");
      if (totalMonde) {
        const parts = new Map(Array.from(totaux, ([pays, valeur]) => [pays, (100 * valeur) / totalMonde]));
        partsParAnnee.set(annee, parts);
      }
    }

    // Le maximum couvre toutes les années pour cette viande et les pays affichés pour qu'une même couleur 
    // représente le même taux pendant la lecture et garder une cohérence entre chaque année
    const maximum = d3.max(partsParAnnee.values(), (parts) => d3.max(paysCarte, (d) => lirePartPays(parts, d)));
    const donnees = { partsParAnnee, maximum };
    donneesParViande.set(id, donnees);
    return donnees;
  }

  function masquerInfobulle() {
    infobulle.hidden = true;
  }

  function dessinerCarte() {
    const annee = Number(curseurAnnee.value);
    const countries = topojson.feature(monde, monde.objects.countries);
    const countrymesh = topojson.mesh(monde, monde.objects.countries, (a, b) => a !== b);
    const donnees = viande ? calculerDonneesViande(viande, countries.features) : null;
    const parts = donnees?.partsParAnnee.get(annee);
    const partPays = (d) => lirePartPays(parts, d);
    const maximum = donnees?.maximum;
    const afficherLegende = maximum !== undefined;

    const titre = document.createElement("p");
    if (!viande) {
      titre.textContent = "Cliquez sur une barre pour voir d'où viennent les importations.";
    } else if (!parts) {
      titre.textContent = `Pas de données par pays : ${viande.nomCategorie} (${annee}).`;
    } else {
      titre.textContent = `${viande.nomCategorie} (${annee}) : part de chaque pays dans les importations françaises`;
    }

    const width = 928;
    const hauteurLegende = 40;
    const margeCarte = 2;

    const projection = d3
      .geoProjection((lambda, phi) => {
        const [, y] = d3.geoMercatorRaw(lambda, phi * 0.8);
        return [lambda, y / 0.8];
      })
      .scale((width - 2 * margeCarte) / (2 * Math.PI))
      .translate([width / 2, 0]);

    const nord = projection([0, 80])[1];
    const sud = projection([0, -60])[1];
    const height = sud - nord + 2 * margeCarte;
    projection
      .translate([width / 2, margeCarte - nord])
      .clipExtent([[margeCarte, margeCarte], [width - margeCarte, height - margeCarte]]);
    const path = d3.geoPath(projection);

    const couleur = d3.scaleSequential([0, maximum || 1], d3.interpolateYlOrRd);

    const svg = d3
      .create("svg")
      .attr("viewBox", [0, 0, width, height + (afficherLegende ? hauteurLegende : 0)])
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
          : `${nom} : ${formaterNombreSelonValeur(part)} % des importations`;
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

    if (afficherLegende) {
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
        .text(formaterNombreSelonValeur(maximum) + " %");
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
