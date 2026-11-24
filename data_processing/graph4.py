import pandas as pd
from pathlib import Path


def traitement(path):
    df = pd.read_csv(path / "owid-co2-data.csv")
    
    df = df[df['iso_code'].notna()]
    df = df[['country','year','co2']]
    df = df[df['year']>1950]
    df = df[df['co2'].notna()]

    df.to_csv(path / 'graph4.csv', index=False)


def main():
    path = Path("../resources/graph4")
    traitement(path)
    

if __name__ == "__main__":
    main()