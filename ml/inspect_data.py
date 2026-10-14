
import pandas as pd
import pyarrow.parquet as pq

D = r"C:\Users\Administrator\Desktop\PROJECT WEX 428\Project Dataset for Machine Learning"

pd.set_option("display.width", 200)
pd.set_option("display.max_colwidth", 100)

for name in ["distribution", "prompts"]:
    df = pd.read_parquet(f"{D}\\{name}.parquet")
    print(f"\n===== {name}  shape={df.shape}")
    print(df.dtypes)
    print(df.head(5))

pf = pq.ParquetFile(f"{D}\\data.parquet")
print("\n===== data.parquet")
print("Rows:", pf.metadata.num_rows)
print(pf.schema_arrow)

first = next(pf.iter_batches(batch_size=2000)).to_pandas()
print("\nFirst row:")
for col in first.columns:
    print(f"- {col}: {str(first[col].iloc[0])[:150]!r}")

for col in first.columns:
    if first[col].nunique() < 40:
        print(f"\nValue counts for '{col}' (first 2000 rows):")
        print(first[col].value_counts())

for col in first.columns:
    if pd.api.types.is_string_dtype(first[col]) and first[col].astype(str).str.len().mean() > 200:
        print(f"\nWord count stats for '{col}':")
        print(first[col].str.split().str.len().describe())