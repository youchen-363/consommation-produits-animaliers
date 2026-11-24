from pathlib import Path
import pandas as pd 

def print_file_structure(path: Path) -> None:
    df = pd.read_csv(path, sep=";", decimal=",")
    print(df.info())

def unzip_file(file_path: Path, destination: Path) -> None:
    from zipfile import ZipFile
    with ZipFile(file_path, 'r') as zip_ref:
        zip_ref.extractall(destination)
        
def merge_files(path: Path, destination: Path) -> None:
    csv_files = sorted(
        f for f in path.iterdir() 
        if f.is_file and f.suffix == ".csv" and f.name != "graph3.csv"
        )
    df = None
    for f in csv_files:
        df = pd.concat([df, pd.read_csv(f, sep=';', decimal=",")])    
    df.to_csv(destination, sep=";", decimal=",", index=False)

def delete_files(path: Path) -> None:
    import os
    for f in path.iterdir():
        if f.is_file and f.suffix == ".csv" and f.name != "graph3.csv":
            os.remove(f)

def main():
    path = Path("resources/graph3")
    zip_file = path / "FDS_COMEXVIANDE.zip"
    unzip_file(zip_file, path)
    merge_files(path, path / "graph3.csv")
    delete_files(path)
    print_file_structure(path / "graph3.csv")
    
if __name__ == "__main__":
    main()