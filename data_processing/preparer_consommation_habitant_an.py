import pandas as pd
from pathlib import Path


# Source du jeu de données (celui de 72ko): https://agreste.agriculture.gouv.fr/agreste-web/disaron/GraFra2025Chap10.2/detail/
def traitement(path):
    df = pd.read_excel(path / "GraphAgri2025_consommation-alim._viandes-produits-laitiers-oeufs_page119.xlsx", sheet_name=3, header=5, usecols='B:BO', nrows=5)
    df = df.rename(columns={'Unnamed: 1':'categorie', "2024p":"2024"})
    df.iloc[4,0] = "Autres viandes"

    dates = df.columns.tolist()
    df = pd.melt(df, id_vars=["categorie"], value_vars=dates[1:])

    df.to_csv(path / "data" / "consommation_habitant_an.csv", index=False)


def main():
    path = Path(__file__).resolve().parents[1]
    traitement(path)
    

if __name__ == "__main__":
    main()
