import pandas as pd
from pathlib import Path

# Source du jeu de données: https://agreste.agriculture.gouv.fr/agreste-web/disaron/APPROVISIONNEMENT-SeriesLongues/detail/
def traitement(path):
    fichier = path / "BilansViandVolailOeufsHistoriques.xls"
    # feuille Excel -> nom de categorie dans le CSV
    feuilles_excel = {                      
        "HistoViandesBovines": "bovine",
        "HistoViandesPorcines": "porcine",
        "HistoViandesVolailles": "volaille",
        "HistoViandesOvinesCaprines": "ovine",
    }

    lignes = []
    for feuille, categorie in feuilles_excel.items():
        tableau = pd.read_excel(fichier, sheet_name=feuille, header=None)
        # colonne C = noms des lignes
        libelles = tableau[2].astype(str).str.strip()          

        annees = tableau[libelles == "Années"].iloc[0]
        imports = tableau[libelles == "IMPORTATIONS"].iloc[0]
        conso = tableau[libelles.str.startswith("UTILISATION")].iloc[0]
        
        for col in tableau.columns[3:]:                        
            # les annees commencent colonne D
            annee = annees[col]
            if pd.notna(annee) and 1999 <= annee <= 2024:
                taux = 100 * imports[col] / conso[col]
                lignes.append({"annee": int(annee), "categorie": categorie,
                            "taux_importe": round(taux, 1)})

    pd.DataFrame(lignes).to_csv(path / "data" / "taux_importation.csv", index=False)


def main():
    path = Path(__file__).resolve().parents[1]
    traitement(path)

if __name__ == "__main__":
    main()