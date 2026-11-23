import pandas as pd 
from pathlib import Path

path = Path("resources/graph3")

df = pd.read_csv(path / "FDS_COMEXVIANDE_1999.csv")
print(df.info())