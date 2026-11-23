from pathlib import Path
import pandas as pd 

def print_file_structure(path: Path) -> None:
    df = pd.read_csv(path, sep=";")
    print(df.info())

def unzip_file(file_path: Path, destination: Path) -> None:
    from zipfile import ZipFile
    with ZipFile(file_path, 'r') as zip_ref:
        zip_ref.extractall(destination)
        
def merge_files(path: Path, destination: Path) -> None:
    for f in path.iterdir():
        if f.is_file() and f.suffix == ".csv":
            with open(destination, "a") as dest:
                dest.write(f.read_text())

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