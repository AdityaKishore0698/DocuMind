import requests, json
r = requests.post("http://ollama:11434/api/pull", json={"name": "llama3"}, stream=True)
for line in r.iter_lines():
    if line:
        data = json.loads(line)
        if "downloading" not in data.get("status","") and "pulling" not in data.get("status",""):
            print(data.get("status"))
print("Done!")
