"""Calcule le taux d'importation par type de viande (2015-2024)
a partir des bilans d'approvisionnement Agreste.

taux_importe = 100 * IMPORTATIONS / UTILISATION INTERIEURE
(les deux lignes sont en milliers de tonnes equivalent-carcasse)

Usage : python3 preparer_taux_import.py chemin/vers/BilansViandVolailOeufsHistoriques.xls
Sortie : taux_importation.csv  (colonnes : annee,categorie,taux_importe)
"""
import sys
import pandas as pd

FICHIER = sys.argv[1]
FEUILLES = {                       # feuille Excel -> nom de categorie dans le CSV
    "HistoViandesBovines": "bovine",
    "HistoViandesPorcines": "porcine",
    "HistoViandesVolailles": "volaille",
    "HistoViandesOvinesCaprines": "ovine",
}

lignes = []
for feuille, categorie in FEUILLES.items():
    tableau = pd.read_excel(FICHIER, sheet_name=feuille, header=None)
    libelles = tableau[2].astype(str).str.strip()          # colonne C = noms des lignes

    annees = tableau[libelles == "Années"].iloc[0]
    imports = tableau[libelles == "IMPORTATIONS"].iloc[0]
    conso = tableau[libelles.str.startswith("UTILISATION")].iloc[0]

    for col in tableau.columns[3:]:                        # les annees commencent colonne D
        annee = annees[col]
        if pd.notna(annee) and 1999 <= annee <= 2024:
            taux = 100 * imports[col] / conso[col]
            lignes.append({"annee": int(annee), "categorie": categorie,
                           "taux_importe": round(taux, 1)})

pd.DataFrame(lignes).to_csv("taux_importation.csv", index=False)
print(f"{len(lignes)} lignes ecrites dans taux_importation.csv")
