from infrastructure.json_storage import load_notes, save_notes
import uuid
from datetime import datetime


class NoteService:

    def load(self):
        return load_notes()
    
    def save(self, notes):
        return save_notes(notes)
    

    def save_note(self, title, content, current_note_id):

        notes = self.load()
        now = datetime.now().isoformat()

        #auto title
        if title.strip() == "":
            titles = [note["title"] for note in notes.values()]

            numbers = []
            for t in titles:
                if t.startswith("Note - "):
                    try:
                        num = int(t.split("Note - ")[1])
                        numbers.append(num)
                    except:
                        pass

            if numbers:
                next_number = max(numbers) + 1
            else:
                next_number = 1

            title = f"Note - {next_number}"


        #new note
        if current_note_id is None:
            note_id = str(uuid.uuid4())

            notes[note_id] = {
                "id": note_id,
                "title": title,
                "content": content,
                "created_at": now,
                "updated_at": now,
                "is_synced": False
            }

        #update
        else:
            note_id = current_note_id
            note = notes[note_id]

            note["title"] = title
            note["content"] = content
            note["updated_at"] = now

            notes[note_id] = note

        self.save(notes)

        return note_id



    def delete(self, note_id):

        if note_id is None:
            return
        
        notes = self.load()

        if note_id in notes:
            del notes[note_id]
            self.save(notes)



    def get_all_notes(self):
        notes = self.load()

        sorted_notes = sorted(
            notes.values(),
            key=lambda n: n.get("updated_at", ""),
            reverse=True)

        return sorted_notes


    def get_note(self, note_id):
        if note_id is None:
            return None

        notes = self.load()
        return notes.get(note_id)



    def get_relative_time(self, iso_string):

        updated_time = datetime.fromisoformat(iso_string)
        now = datetime.now()

        delta = now - updated_time

        seconds = int(delta.total_seconds())
        minutes = seconds // 60
        hours = minutes // 60
        days = delta.days

        if seconds < 60:
            return "Just now"
        elif minutes < 60:
            return f"{minutes} minute{'s' if minutes > 1 else ''} ago"
        elif hours < 24:
            return f"{hours} hour{'s' if hours > 1 else ''} ago"
        elif days == 1:
            return "Yesterday"
        elif days < 7:
            return f"{days} days ago"
        elif days < 30:
            weeks = days // 7
            return f"{weeks} week{'s' if weeks > 1 else ''} ago"
        elif days < 365:
            months = days // 30
            return f"{months} month{'s' if months > 1 else ''} ago"
        else:
            years = days // 365
            return f"{years} year{'s' if years > 1 else ''} ago"