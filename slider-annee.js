"use strict";

const initialiserSliderAnnee = (conteneur, {
  premiereAnnee,
  derniereAnnee,
  onChange,
  delai = 500
}) => {
  const curseurAnnee = conteneur.querySelector("input[type=range]");
  const texteAnnee = conteneur.querySelector("output");
  const boutonLecture = conteneur.querySelector("[data-lecture]");
  const boutonPrecedent = conteneur.querySelector("[data-precedent]");
  const boutonSuivant = conteneur.querySelector("[data-suivant]");
  const barreAnnee = curseurAnnee.parentElement;

  let anneeChoisie = premiereAnnee;
  let intervalleLecture = null;

  function actualiserBoutonLecture() {
    boutonLecture.textContent = intervalleLecture !== null ? "Pause" : anneeChoisie === derniereAnnee ? "Rejouer" : "Lecture";
  }

  function arreterLecture() {
    clearInterval(intervalleLecture);
    intervalleLecture = null;
    actualiserBoutonLecture();
  }

  function actualiserAnnee() {
    // les inputs renvoient des textes, Number les convertit en nombres
    anneeChoisie = Number(curseurAnnee.value);
    texteAnnee.value = String(anneeChoisie);

    // un seul curseur : la partie colorée de la piste va du début jusqu'à la poignée
    const dureeTotale = Math.max(1, derniereAnnee - premiereAnnee);
    const progression = (anneeChoisie - premiereAnnee) / dureeTotale;
    barreAnnee.style.setProperty("--debut", "0%");
    barreAnnee.style.setProperty("--fin", 100 * progression + "%");
    barreAnnee.style.setProperty("--progression", progression);

    boutonPrecedent.disabled = anneeChoisie === premiereAnnee;
    boutonSuivant.disabled = anneeChoisie === derniereAnnee;
    actualiserBoutonLecture();
    onChange(anneeChoisie);
    // on envoie notre propre event au conteneur pour lire un changement depuis un autre script (ici celui de la carte 
    // pour la mettre à jour en plus du graphe)
    conteneur.dispatchEvent(new CustomEvent("changement-annee", { detail: anneeChoisie }));
  }

  function decalerAnnee(pas) {
    arreterLecture();
    curseurAnnee.value = Math.max(premiereAnnee, Math.min(derniereAnnee, anneeChoisie + pas));
    actualiserAnnee();
  }

  curseurAnnee.min = premiereAnnee;
  curseurAnnee.max = derniereAnnee;
  curseurAnnee.step = 1;
  curseurAnnee.value = anneeChoisie;
  conteneur.querySelector("[data-premiere-annee]").textContent = premiereAnnee;
  conteneur.querySelector("[data-derniere-annee]").textContent = derniereAnnee;
  boutonLecture.disabled = premiereAnnee === derniereAnnee;

  boutonPrecedent.addEventListener("click", () => decalerAnnee(-1));
  boutonSuivant.addEventListener("click", () => decalerAnnee(1));
  curseurAnnee.addEventListener("input", () => {
    arreterLecture();
    actualiserAnnee();
  });

  boutonLecture.addEventListener("click", () => {
    if (intervalleLecture !== null) {
      arreterLecture();
      return;
    }

    if (anneeChoisie === derniereAnnee) {
      curseurAnnee.value = premiereAnnee;
      actualiserAnnee();
    }

    intervalleLecture = setInterval(() => {
      curseurAnnee.value = anneeChoisie + 1;
      actualiserAnnee();

      if (anneeChoisie === derniereAnnee) {
        arreterLecture();
      }
    }, delai);
    actualiserBoutonLecture();
  });

  actualiserAnnee();

  return { arreterLecture };
}
