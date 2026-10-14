import pandas as pd

df = pd.read_parquet(r"C:\Users\Administrator\Desktop\ai-content-inspector\data\sample.parquet")

for label, name in [(0, "HUMAN"), (1, "AI")]:
    part = df[df["label"] == label].sample(3, random_state=7)
    for _, row in part.iterrows():
        print(f"\n===== {name}  (source: {row['source']}) =====")
        print(row["text"][:500])