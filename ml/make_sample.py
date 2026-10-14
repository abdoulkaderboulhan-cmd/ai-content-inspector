import random
import pyarrow.parquet as pq
import pandas as pd

D = r"C:\Users\Administrator\Desktop\PROJECT WEX 428\Project Dataset for Machine Learning"
OUT = r"C:\Users\Administrator\Desktop\ai-content-inspector\data\sample.parquet"

random.seed(42)
KEEP = 0.10          # keep about 10% of all rows
MAX_CHARS = 3000     # cut very long texts

pf = pq.ParquetFile(f"{D}\\data.parquet")
parts = []
total = 0

for batch in pf.iter_batches(batch_size=20000, columns=["text", "source", "prompt_id"]):
    df = batch.to_pandas()
    df = df.sample(frac=KEEP, random_state=random.randint(0, 10**6))
    df["text"] = df["text"].str.slice(0, MAX_CHARS)
    parts.append(df)
    total += len(df)
    print("rows kept so far:", total, flush=True)

sample = pd.concat(parts, ignore_index=True)
sample["label"] = (sample["source"] != "Human").astype(int)   # 0 = human, 1 = AI
sample.to_parquet(OUT)

print("\nDONE. Saved", len(sample), "rows")
print(sample["label"].value_counts())
print(sample["source"].value_counts().head(10))