import requests, json, sys

print("Pulling llama3.1...")
try:
    r = requests.post("http://ollama:11434/api/pull", json={"name": "llama3.1"}, stream=True)
    for line in r.iter_lines():
        if line:
            data = json.loads(line)
            status = data.get("status","")
            if "downloading" not in status and "pulling" not in status:
                print(status)
    print("Done pulling llama3.1!")
except Exception as e:
    print(f"Error pulling model: {e}")
