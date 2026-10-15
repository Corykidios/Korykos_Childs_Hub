import json
import os


Data_Path = "data/notes.json"

def load_notes():
    if not os.path.exists(Data_Path):
        return {}
    
    try:
        with open(Data_Path, "r", encoding="utf-8") as f:
            return json.load(f)
    
    except json.JSONDecodeError:
        return {}



def save_notes(notes_dict):
    # if not os.path.exists(Data_Path):     #not necessaty cause its already create a file if doest exist.
    #     return {}
    
    with open(Data_Path, "w", encoding="utf-8") as f:
        json.dump(notes_dict, f, indent=4, ensure_ascii=False)
