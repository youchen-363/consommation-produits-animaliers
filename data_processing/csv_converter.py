import pandas as pd 
from pathlib import Path

def convert_to_comma(path: Path, format: str) -> None:
    for f in path.iterdir():
        if f.is_file():
            content = f.read_text().split(format)
            new_content = ",".join(content)
            f.write_text(new_content)

def print_file_structure(path: Path) -> None:
    df = pd.read_csv(path)
    print(df.info())

def print_files_structure(dir: Path) -> None:
    for f in dir.iterdir():
        if f.is_file():
            print_file_structure(f)
            
def main():
    path = Path("resources/graph3")
    convert_to_comma(path, ";")
    print_files_structure(path)
    
if __name__ == "__main__":
    main()