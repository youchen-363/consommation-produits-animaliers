from pathlib import Path
import pandas as pd 

def print_file_structure(path: Path) -> None:
    df = pd.read_csv(path, sep=";")
    print(df.info())

def print_files_structure(dir: Path) -> None:
    for f in dir.iterdir():
        if f.is_file() and f.suffix == ".csv":
            print_file_structure(f)

def unzip_file(file_path: Path, destination: Path):
    from zipfile import ZipFile
    with ZipFile(file_path, 'r') as zip_ref:
        zip_ref.extractall(destination)
            
def main():
    path = Path("resources/graph3")
    zip_file = path / "FDS_COMEXVIANDE.zip"
    unzip_file(zip_file, path)
    print_files_structure(path)
    
if __name__ == "__main__":
    main()