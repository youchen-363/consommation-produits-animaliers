import pandas as pd
from pathlib import Path

# Source du jeu de données (attention il est fat): https://bulks-faostat.fao.org/production/Environment_Emissions_intensities_E_All_Data_%28Normalized%29.zip
def traitement(path):
    categories = {
        "Meat of cattle with the bone, fresh or chilled": "bovine",
        "Meat of pig with the bone, fresh or chilled": "porcine",
        "Meat of chickens, fresh or chilled": "volaille",
        "Meat of sheep, fresh or chilled": "ovine-caprine",
        "Meat of goat, fresh or chilled": "ovine-caprine",
    }
    indicateurs = {
        "Emissions (CO2eq) (AR5)": "emissions_kt_co2e",
        "Production": "production_t",
    }

    df = pd.read_csv(
        path / "Environment_Emissions_intensities_E_All_Data_(Normalized).csv",
        usecols=["Area Code", "Area Code (M49)", "Area", "Item", "Element", "Year", "Value"],
    )
    # Le code 351 regroupe la Chine et plusieurs territoires 
    df = df[(df["Area Code"] < 5000) & (df["Area Code"] != 351)].copy()
    df["categorie"] = df["Item"].map(categories)
    df["indicateur"] = df["Element"].map(indicateurs)
    df = df.dropna(subset=["categorie", "indicateur"])
    df = df.rename(columns={"Area Code (M49)": "code_pays_m49", "Area": "pays", "Year": "annee"})
    df["code_pays_m49"] = df["code_pays_m49"].str.lstrip("'")

    cles = ["code_pays_m49", "pays", "annee", "categorie"]
    mesures = ["emissions_kt_co2e", "production_t"]
    df = df.pivot(index=cles + ["Item"], columns="indicateur", values="Value").reset_index()

    # Additionne mouton et chèvre avant de calculer les émissions par kilo (pour uniformiser la catégorie Ovine et caprine sur le site)
    df["intensite_disponible"] = df[mesures].notna().all(axis=1)
    groupes = df.groupby(cles)
    resultat = groupes[mesures].sum(min_count=1)
    production = resultat["production_t"].where(resultat["production_t"] > 0)
    intensite = 1000 * resultat["emissions_kt_co2e"] / production
    resultat["intensite_kg_co2e_par_kg"] = intensite.where(groupes["intensite_disponible"].all())

    resultat.reset_index().to_csv(path / "data" / "emissions_viande.csv", index=False, float_format="%.6f")


def main():
    path = Path(__file__).resolve().parents[1]
    traitement(path)

if __name__ == "__main__":
    main()
