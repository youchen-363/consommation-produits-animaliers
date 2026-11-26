from pathlib import Path
from tempfile import TemporaryDirectory
import pandas as pd 

def print_file_structure(path: Path) -> None:
    df = pd.read_csv(path)
    print(df.info())

def unzip_file(file_path: Path, destination: Path) -> None:
    from zipfile import ZipFile
    with ZipFile(file_path, 'r') as zip_ref:
        zip_ref.extractall(destination)
        
def merge_files(path: Path) -> pd.DataFrame:
    csv_files = get_sorted_files(path)
    df = None
    for f in csv_files:
        df = pd.concat([df, pd.read_csv(f, sep=';', decimal=",", dtype={
            "N053_MOD": str,
            "N500_MOD": str,
            })])
    return df

def get_sorted_files(path):
    csv_files = sorted(
        f for f in path.iterdir() 
        if f.is_file and f.suffix == ".csv" and f.name != "importation.csv"
        )
    return csv_files

def delete_files(path: Path, exception: list = []) -> None:
    import os
    for f in path.iterdir():
        if f.is_file and f.suffix == ".csv" and f not in exception:
            os.remove(f)
    
def rename_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.rename(columns={
        "ANNREF": "annee",
        "COMEXVIANDE_DIM2_MOD": "pays",
        "N500_MOD": "type",
        "VALEUR": "valeur"
    })
    return df

def covert_month_to_int(df: pd.DataFrame) -> None:
    df["N053_MOD"] = df["N053_MOD"].str.split('.').str[-1].astype(int)

def filter_data(df: pd.DataFrame) -> pd.DataFrame:
    df = df[(df["N053_MOD"] == 0) & (df["COMEXVIANDE_DIM1_MOD"] == 2) & (df["ANNREF"] <= 2024) & (df['VALEUR'] != 0)]
    return df

def process(df: pd.DataFrame) -> pd.DataFrame:
    df = filter_data(df)
    df = rename_columns(df)
    return df
    
def mapping_rules(df: pd.DataFrame) -> None:
    pays_pairs = df[["COMEXVIANDE_DIM2_LIB", "COMEXVIANDE_DIM2_MOD"]].drop_duplicates()
    pays_mapper = dict(zip(pays_pairs["COMEXVIANDE_DIM2_MOD"].to_list(), pays_pairs["COMEXVIANDE_DIM2_LIB"].to_list()))
    
    type_de_viande_pairs = df[["N500_LIB", "N500_MOD"]].drop_duplicates()
    type_de_viande_mapper = dict(zip(type_de_viande_pairs["N500_MOD"].to_list(), type_de_viande_pairs["N500_LIB"].to_list()))
    
    mappers = {
        "pays": pays_mapper,
        "type": type_de_viande_mapper
    }
    return mappers

def save_json(path: Path, mappers: dict) -> None:
    import json
    with open(path, "w", encoding='utf-8') as file:
        json.dump(mappers, file, indent=4, ensure_ascii=False)
    
def save_csv(df: pd.DataFrame, destination: Path, columns: list) -> None: 
    df.to_csv(destination, encoding='utf-8', decimal='.', index=False, columns=columns)    
    
def process_merged_csv(source_path: Path, data_path: Path) -> None:
    csv_path = data_path / "importation.csv"
    mapper_path = data_path / "mapping_rules.json"
    df = merge_files(source_path)
    covert_month_to_int(df)
    mapper = mapping_rules(df)
    df = process(df)
    save_json(mapper_path, mapper)
    save_csv(df, csv_path, columns=["annee", "pays", "type", "valeur"])
    print_file_structure(csv_path)
        
def process_unmerged_csv(path: Path) -> None:
    csv_files = get_sorted_files(path)
    delete_files(path, exception=csv_files)
    for file in csv_files:
        df = pd.read_csv(file, sep=';', decimal=",", dtype={
            "N053_MOD": str,
            "N500_MOD": str,
        })
        covert_month_to_int(df)
        df = process(df)
        save_csv(df, file, columns=["pays", "type", "valeur"])
        print_file_structure(file)
    
def format_json(path: Path) -> None:
    import json
    data = None
    with open(path, "r") as file:
        data = json.load(file)
    with open(path, "w") as file:
        json.dump(data, file, indent=4, ensure_ascii=False)

# Source du jeu de données (attention tres fat celui la): https://agreste.agriculture.gouv.fr/agreste-web/disaron/COMEXVIANDE/detail/
def traitement(path):
    with TemporaryDirectory() as dossier:
        source_path = Path(dossier)
        unzip_file(path / "FDS_COMEXVIANDE.zip", source_path)
        process_merged_csv(source_path, path / "data")


def main():
    path = Path(__file__).resolve().parents[1]
    traitement(path)

if __name__ == "__main__":
    main()