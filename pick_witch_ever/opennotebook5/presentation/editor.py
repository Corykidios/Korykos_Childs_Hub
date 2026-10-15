import customtkinter as ctk
from datetime import datetime
import uuid
from core.note_service import NoteService


class Editor(ctk.CTkFrame):
    def __init__(self, master, note_service):
        super().__init__(master)

        self.note_service = note_service

        self.note_service = NoteService()

        self.configure(fg_color="#113232")
        self.pack(side="left", fill="both", expand=True)

        #title
        self.title = ctk.CTkEntry(self, fg_color="#052424", font=("Consolas", 14), height=30)
        self.title.pack(fill="x", expand=False, padx=20, pady=(20,0))

        #modified label
        self.modified_label = ctk.CTkLabel(self, text="", font=("Arial", 11), text_color="gray")
        self.modified_label.pack(pady=(2,5))
        
        #textbox
        self.textbox = ctk.CTkTextbox(self, fg_color="#052424" ,font=("Consolas", 14))
        self.textbox.pack(fill="both", expand=True, padx=20, pady=(5,20))

        #save button
        self.save_button = ctk.CTkButton(self, text="Save", fg_color="#264242", command=self.save_note)
        self.save_button.pack(pady=(0,20))

        #delete button
        self.delete_button = ctk.CTkButton(self, text="Delete", fg_color="#264242", command=self.delete_note)
        self.delete_button.pack(pady=(0,20))

        #status label
        self.status_label = ctk.CTkLabel(self, text="", font=("Arial", 12), fg_color="#052424")
        self.status_label.pack(pady=(0, 0))



        self.current_note_id = None




    def clear(self):
        self.textbox.delete("1.0","end")
        self.title.delete("0", "end")
        self.modified_label.configure(text="")


    

    def save_note(self):
        title = self.title.get().strip()
        content = self.textbox.get("1.0", "end").strip()

        note_id = self.note_service.save_note(
            title,
            content,
            self.current_note_id
        )

        self.current_note_id = note_id

        self.master.refresh_sidebar()

        # title input'u core'un ürettiği title ile güncelle
        notes = self.note_service.load()
        saved_note = notes[self.current_note_id]
        self.title.delete(0, "end")
        self.title.insert(0, saved_note["title"])

        self.master.sidebar.refresh_notes()
        self.show_status("Saved ✔")




    def delete_note(self):

        if self.current_note_id is None:
            self.clear()
            self.show_status("Page Cleared")
            return

        self.note_service.delete(self.current_note_id)

        self.current_note_id = None
        self.clear()
        self.master.sidebar.refresh_notes()

        self.show_status("Deleted 🗑")





    def show_status(self, message):
        self.status_label.configure(text=message)
        self.status_label.after(2000, lambda: self.status_label.configure(text=""))



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






