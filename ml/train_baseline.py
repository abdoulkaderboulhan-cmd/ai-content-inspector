import joblib
import pandas as pd
from sklearn.model_selection import GroupShuffleSplit, train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

DATA = r"C:\Users\Administrator\Desktop\ai-content-inspector\data\sample.parquet"
MODEL_OUT = r"C:\Users\Administrator\Desktop\ai-content-inspector\ml\baseline_model.joblib"

df = pd.read_parquet(DATA)
print("Loaded", len(df), "texts")
print("Texts with prompt_id 0:", (df["prompt_id"] == 0).sum())

# part 1: rows that have a real prompt -> split by prompt
real = df[df["prompt_id"] != 0]
undef = df[df["prompt_id"] == 0]

parts_train, parts_test = [], []
if len(real) > 0:
    gs = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
    a, b = next(gs.split(real, groups=real["prompt_id"]))
    parts_train.append(real.iloc[a])
    parts_test.append(real.iloc[b])

# part 2: "undefined prompt" rows -> random split, same human/AI ratio on both sides
u_train, u_test = train_test_split(undef, test_size=0.2, random_state=42,
                                   stratify=undef["label"])
parts_train.append(u_train)
parts_test.append(u_test)

train = pd.concat(parts_train)
test = pd.concat(parts_test)
print("Train:", len(train), " Test:", len(test))
print("Test set human/AI counts:")
print(test["label"].value_counts(), flush=True)

print("Turning text into numbers (TF-IDF)...", flush=True)
vec = TfidfVectorizer(max_features=100000, ngram_range=(1, 2),
                      min_df=5, sublinear_tf=True)
X_train = vec.fit_transform(train["text"])
X_test = vec.transform(test["text"])

print("Training the model...", flush=True)
clf = LogisticRegression(C=4, solver="liblinear", max_iter=1000)
clf.fit(X_train, train["label"])

pred = clf.predict(X_test)
print("\nACCURACY on unseen test texts:", round(accuracy_score(test["label"], pred), 4))
print("\nConfusion matrix (rows = real, columns = predicted; 0 = human, 1 = AI):")
print(confusion_matrix(test["label"], pred))
print("\n", classification_report(test["label"], pred, target_names=["Human", "AI"]))

joblib.dump({"vectorizer": vec, "model": clf}, MODEL_OUT)
print("Model saved to", MODEL_OUT)