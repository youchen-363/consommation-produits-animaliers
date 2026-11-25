"use strict";

const vues = Array.from(document.querySelectorAll(".view, #rapport"));

// je sais pas si c'est la meilleure manière de procéder mais la manière dont on change de vue
// s'appuie sur le hashtag de l'url, AKA le href sur lequel on a cliqué
const changerVue = () => {
  const destination = window.location.hash.slice(1);
  const vue = vues.find((section) => section.id === destination ) || vues[0];

  // affiche la vue courante et cache les autres
  document.getElementById("exploration").hidden = vue.id === "rapport";
  for (const section of vues) {
    section.hidden = section !== vue;
  }

  const message = vue.dataset.message || "";
  document.getElementById("texte-rubrique").textContent = message;
  document.querySelector(".page-story").hidden = !message;

  for (const lien of document.querySelectorAll("nav a")) {
    const accueilActif = lien.hash === "#accueil" && vue.id !== "rapport";
    lien.classList.toggle("active", lien.hash === "#" + vue.id || accueilActif);
  }

  document.dispatchEvent(new Event("changement-vue"));
  window.scrollTo(0, 0);
}

// hashchange est trigger quand le hashtag dans l'url change
window.addEventListener("hashchange", changerVue);
changerVue();

