import sys
import joblib

MODEL = r"C:\Users\Administrator\Desktop\ai-content-inspector\ml\baseline_model.joblib"

bundle = joblib.load(MODEL)
vec, clf = bundle["vectorizer"], bundle["model"]

def predict(text):
    X = vec.transform([text])
    p_ai = float(clf.predict_proba(X)[0][1])
    label = "AI" if p_ai >= 0.5 else "Human"
    confidence = p_ai if label == "AI" else 1 - p_ai
    return label, confidence

if __name__ == "__main__":
    with open(sys.argv[1], encoding="utf-8") as f:
        text = f.read()
    label, conf = predict(text)
    print(f"\nPrediction: {label}   Confidence: {conf:.1%}")