import requests, json, sys
for model in ["nomic-embed-text", "llama3"]:
    print(f"Pulling {model}...")
    r = requests.post("http://ollama:11434/api/pull", json={"name": model}, stream=True)
    for line in r.iter_lines():
        if line: print(json.loads(line).get("status", ""))
print("Done!")
