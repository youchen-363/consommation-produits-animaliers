import pandas as pd
from pathlib import Path

# Source du jeu de données:  https://www.insee.fr/fr/statistiques/fichier/2830244/econ-gen-revenu-dispo-pouv-achat-2.xlsx

def traitement(path):
    df = pd.read_excel(
        path / "econ-gen-revenu-dispo-pouv-achat-2.xlsx",
        sheet_name="Figure 1",
        header=3,
        index_col=0,
    )
    revenu = df.loc["Revenu disponible brut"].astype(float) / 100
    unites = df.loc["Nombre d'unités de consommation"].astype(float) / 100

    variation = ((1 + revenu) / (1 + unites) - 1) * 100
    # Les années 2024 et 2025 ont un suffixe "ps" dans le tableau donc on garde que les 4 premiers chars
    variation.index = variation.index.astype(str).str[:4].astype(int)
    variation = variation.round(6).rename("variation_revenu_nominal_uc_pct")
    variation.rename_axis("annee").to_csv(path / "data" / "revenus_france.csv")


def main():
    path = Path(__file__).resolve().parents[1]
    traitement(path)

if __name__ == "__main__":
    main()
