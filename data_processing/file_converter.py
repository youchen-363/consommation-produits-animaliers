from pathlib import Path
import pandas as pd 

def print_file_structure(path: Path) -> None:
    df = pd.read_csv(path, sep=";", decimal=",")
    print(df.info())

def unzip_file(file_path: Path, destination: Path) -> None:
    from zipfile import ZipFile
    with ZipFile(file_path, 'r') as zip_ref:
        zip_ref.extractall(destination)
        
def merge_files(path: Path, destination: Path) -> pd.DataFrame:
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
        if f.is_file and f.suffix == ".csv" and f.name != "FDS_COMEXVIANDE_1999_2026.csv"
        )
    return csv_files

def delete_files(path: Path, exception: list) -> None:
    import os
    for f in path.iterdir():
        if f.is_file and f.suffix == ".csv" and f not in exception:
            os.remove(f)
    
def rename_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.rename(columns={
        "ANNREF": "annee",
        "COMEXVIANDE_DIM1_MOD": "indicateur",
        "COMEXVIANDE_DIM2_MOD": "pays_d_echange",
        "N500_MOD": "type_de_viande",
        "N053_MOD": "periodicite",
        "VALEUR": "valeur"
    })
    return df

def covert_month_to_int(df: pd.DataFrame) -> None:
    df["N053_MOD"] = df["N053_MOD"].str.split('.').str[-1].astype(int)

def process(df: pd.DataFrame) -> pd.DataFrame:
    df = rename_columns(df)
    return df
    
def mapping_rules(df: pd.DataFrame) -> None:
    pays_pairs = df[["COMEXVIANDE_DIM2_LIB", "COMEXVIANDE_DIM2_MOD"]].drop_duplicates()
    pays_mapper = dict(zip(pays_pairs["COMEXVIANDE_DIM2_MOD"].to_list(), pays_pairs["COMEXVIANDE_DIM2_LIB"].to_list()))

    periodicite_pairs = df[["N053_LIB", "N053_MOD"]].drop_duplicates()
    periodicite_mapper = dict(zip(periodicite_pairs["N053_MOD"].to_list(), periodicite_pairs["N053_LIB"].to_list()))

    indicateur_pairs = df[["COMEXVIANDE_DIM1_LIB", "COMEXVIANDE_DIM1_MOD"]].drop_duplicates()
    indicateur_mapper = dict(zip(indicateur_pairs["COMEXVIANDE_DIM1_MOD"].to_list(), indicateur_pairs["COMEXVIANDE_DIM1_LIB"].to_list()))

    type_de_viande_pairs = df[["N500_LIB", "N500_MOD"]].drop_duplicates()
    type_de_viande_mapper = dict(zip(type_de_viande_pairs["N500_MOD"].to_list(), type_de_viande_pairs["N500_LIB"].to_list()))

    mappers = {
        "pays": pays_mapper,
        "periodicite": periodicite_mapper,
        "indicateur": indicateur_mapper,
        "type_viande": type_de_viande_mapper
    }
    return mappers

def save_mapper(path: Path, mappers: dict) -> None:
    import json
    with open(path, "w") as file:
        json.dump(mappers, file, indent=4, ensure_ascii=False)
    
def save_file(df: pd.DataFrame, destination: Path, columns: list) -> None: 
    df.to_csv(destination, sep=";", decimal=",", index=False, columns=columns)    
    
def process_merged_csv(path: Path, mapper_path: Path) -> None:
    csv_path = path / "FDS_COMEXVIANDE_1999_2026.csv"
    df = merge_files(path, csv_path)
    covert_month_to_int(df)
    mapper = mapping_rules(df)
    df = process(df)
    save_mapper(mapper_path, mapper)
    save_file(df, csv_path, columns=["annee", "indicateur", "pays_d_echange", "type_de_viande", "periodicite", "valeur"])
    delete_files(path, exception=[csv_path])
    print_file_structure(csv_path)
        
def process_unmerged_csv(path: Path, mapper_path: Path) -> None:
    csv_files = get_sorted_files(path)
    delete_files(path, exception=csv_files)
    for file in csv_files:
        df = pd.read_csv(file, sep=';', decimal=",", dtype={
            "N053_MOD": str,
            "N500_MOD": str,
        })
        covert_month_to_int(df)
        df = process(df)
        save_file(df, file, columns=["indicateur", "pays_d_echange", "type_de_viande", "periodicite", "valeur"])
        print_file_structure(file)
    
def main():
    path = Path("resources/graph3")
    zip_file = path / "FDS_COMEXVIANDE.zip"
    mapper_path = path / "mapping_rules.json"
    unzip_file(zip_file, path)
    process_unmerged_csv(path, mapper_path)
    
if __name__ == "__main__":
    main()