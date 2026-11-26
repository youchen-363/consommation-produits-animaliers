import pandas as pd
from pathlib import Path

# Source du jeu de données: https://bdm.insee.fr/series/011814750/xlsx?revision=avecrevisions
def traitement(path):
    df = pd.read_excel(
        path / "serie_011814750_rev_26112026.xlsx",
        sheet_name="valeurs_annuelles",
        header=None,
        skiprows=4,
        usecols="A:B",
        names=["annee", "indice_prix_viande"],
    )
    df = df.sort_values("annee")
    df["variation_prix_pct"] = df["indice_prix_viande"].pct_change(fill_method=None).mul(100).round(6)
    df.to_csv(path / "data" / "prix_viande_france.csv", index=False)


def main():
    path = Path(__file__).resolve().parents[1]
    traitement(path)

if __name__ == "__main__":
    main()
