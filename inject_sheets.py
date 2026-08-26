import json

with open("cazas/[tu-dominio.com]/n8n/video-shorts-agents.json", "r") as f:
    data = json.load(f)

# Shift all nodes after "Tomar Solo el Último" by +600 on the X axis
for node in data["nodes"]:
    if node["position"][0] >= 400:
        node["position"][0] += 600

# Add the 3 new nodes
new_nodes = [
    {
      "parameters": {
        "operation": "search",
        "options": {}
      },
      "id": "node-gs-search",
      "name": "Buscar URL en Sheets",
      "type": "n8n-nodes-base.googleSheets",
      "typeVersion": 4.5,
      "position": [400, 0],
      "notes": "Configura tu hoja de Google aquí. Busca la URL del artículo actual."
    },
    {
      "parameters": {
        "conditions": {
          "boolean": [
            {
              "value1": "={{ $json.row_number ? true : false }}",
              "value2": true
            }
          ]
        }
      },
      "id": "node-if-existe",
      "name": "¿Ya existe?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 1,
      "position": [600, 0],
      "notes": "Si es TRUE (ya existe), se detiene. Si es FALSE (nuevo), avanza."
    },
    {
      "parameters": {
        "operation": "append",
        "options": {}
      },
      "id": "node-gs-append",
      "name": "Guardar en Sheets",
      "type": "n8n-nodes-base.googleSheets",
      "typeVersion": 4.5,
      "position": [800, 200],
      "notes": "Anota la nueva URL para que no se repita en el futuro."
    }
]

data["nodes"].extend(new_nodes)

# Update connections
conns = data["connections"]

# Break connection: Tomar Solo el Último -> El Analizador
if "Tomar Solo el Último" in conns and "main" in conns["Tomar Solo el Último"]:
    conns["Tomar Solo el Último"]["main"] = [ [ {"node": "Buscar URL en Sheets", "type": "main", "index": 0} ] ]

# Build new connections
conns["Buscar URL en Sheets"] = {
    "main": [ [ {"node": "¿Ya existe?", "type": "main", "index": 0} ] ]
}

conns["¿Ya existe?"] = {
    "main": [
        [], # True branch (empty, stops)
        [ {"node": "Guardar en Sheets", "type": "main", "index": 0} ] # False branch
    ]
}

conns["Guardar en Sheets"] = {
    "main": [ [ {"node": "El Analizador", "type": "main", "index": 0} ] ]
}

with open("cazas/[tu-dominio.com]/n8n/video-shorts-agents.json", "w") as f:
    json.dump(data, f, indent=2)

print("Injected Google Sheets nodes successfully.")
