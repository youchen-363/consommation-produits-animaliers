"use strict";

async function chargerDonneesConsommation() {
  // Lit le CSV et convertit les colonnes variable et value en nombres (doc ici https://d3js.org/d3-fetch#csv)
  const lignesCsv = await d3.csv("./data/graph1.csv", (ligne) => {
    return {
      categorie: ligne.categorie,
      annee: Number(ligne.variable),
      quantite: ligne.value === "" ? null : Number(ligne.value)
    };
  });

  if (lignesCsv.length === 0) {
    throw new Error("Le fichier graph1.csv est vide :(");
  }

  // Récupère les années présentes dans le fichier, sans doublons et dans l'ordre
  const annees = Array.from(new Set(lignesCsv.map((ligne) => ligne.annee)))
    .sort((anneePrecedente, anneeSuivante) => anneePrecedente - anneeSuivante);

  // Associe les noms du CSV aux catégories et couleurs du graphe
  // en cherchant des couleurs bien distinctes pour les différentes courbes je suis tombé sur ca https://sronpersonalpages.nl/~pault/
  const consommation = [
    {
      id: "bovine",
      nom: "Bovine",
      nomCsv: "Bovins",
      couleur: "#4477aa"
    },
    {
      id: "porcine",
      nom: "Porcine",
      nomCsv: "Porcs",
      couleur: "#228833"
    },
    {
      id: "volaille",
      nom: "Volaille",
      nomCsv: "Volailles",
      couleur: "#ccbb44"
    },
    {
      id: "ovine-caprine",
      nom: "Ovine et caprine",
      nomCsv: "Ovins et caprins",
      couleur: "#ee6677"
    },
    {
      id: "autres",
      nom: "Autres",
      nomCsv: "Autres viandes",
      couleur: "#bbbbbb"
    }
  ];

  for (const categorie of consommation) {
    categorie.valeurs = annees.map((annee) => {
      const observation = lignesCsv.find((ligne) => {
        return ligne.categorie === categorie.nomCsv && ligne.annee === annee;
      });
      return observation ? observation.quantite : null;
    });
  }

  // Le CSV ne contient pas de total donc on additionne les cinq catégories par année nous meme
  const valeursTotal = annees.map((annee, indexAnnee) => {
    const valeursAnnee = consommation.map((categorie) => categorie.valeurs[indexAnnee]);

    return valeursAnnee.includes(null) ? null : d3.sum(valeursAnnee);
  });

  consommation.unshift({
    id: "total",
    nom: "Total",
    couleur: "black",
    valeurs: valeursTotal
  });

  return { annees, consommation };
}

async function chargerDonneesEcartPrixRevenus() {
  // on charge les deux CSV en parallèle et convertit leurs valeurs en nombres
  const [prix, revenus] = await Promise.all([
    d3.csv("data/prix_viande_france.csv", (ligne) => {
      return {
        annee: Number(ligne.annee),
        variation: Number(ligne.variation_prix_pct) 
      };
    }),
    d3.csv("data/revenus_france.csv", (ligne) => {
      return {
        annee: Number(ligne.annee),
        variation: Number(ligne.variation_revenu_nominal_uc_pct)
      };
    })
  ]);

  const donneesFinales = [];

  for (const prixAnnee of prix) {
    // Cherche le revenu de la même année sans se baser sur l'ordre des lignes
    const revenuAnnee = revenus.find((revenu) => revenu.annee === prixAnnee.annee);

    if (!revenuAnnee ||
      !Number.isFinite(prixAnnee.variation) ||
      !Number.isFinite(revenuAnnee.variation)) {
      continue;
    }

    donneesFinales.push({
      annee: prixAnnee.annee,
      variation_prix_pct: prixAnnee.variation,
      variation_revenu_nominal_uc_pct: revenuAnnee.variation,
      ecart_points: prixAnnee.variation - revenuAnnee.variation
    });
  }

  return donneesFinales.sort((anneePrecedente, anneeSuivante) => {
    return anneePrecedente.annee - anneeSuivante.annee;
  });
}

chargerDonneesEcartPrixRevenus().then((data) => console.log(data))