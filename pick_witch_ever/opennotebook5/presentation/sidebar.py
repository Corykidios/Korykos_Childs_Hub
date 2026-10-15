import customtkinter as ctk


class Sidebar(ctk.CTkFrame):
    def __init__(self, master, note_service):
        super().__init__(master)

        self.note_service = note_service

        self.configure(width=200, fg_color="#264242")
        self.pack(side="left", fill="y")


        #title
        self.title = ctk.CTkLabel(self, text="ONB - MENU", font=("Arial", 18, "bold"))
        self.title.pack(pady=(20,10))

        #buttons
        self.btn_editor =ctk.CTkButton(self, text="New Note", fg_color="#052424", command=self.new_note)
        self.btn_editor.pack(pady=10, padx= 20, fill="x")

        #settings
        self.btn_settings = ctk.CTkButton(self, text="Settings", fg_color="#052424")
        self.btn_settings.pack(pady=10, padx=20, fill="x")

        #notes label
        label = ctk.CTkLabel(self, text="Notes")
        label.pack(padx=20, pady=(20,10))


        #slidebar
        self.notes_frame = ctk.CTkScrollableFrame(self, width=100, fg_color="#113232")
        self.notes_frame.pack(fill="both", expand=True, padx=10, pady=(0,20))

        self.refresh_notes()




    def new_note(self):
        self.master.editor.clear()
        self.master.editor.current_note_id = None


    def refresh_notes(self):
        for widget in self.notes_frame.winfo_children():
            widget.destroy()

        notes = self.note_service.get_all_notes()

        for note in notes:
            btn = ctk.CTkButton(
                self.notes_frame,
                text=note["title"],
                fg_color="#052424",
                command=lambda i=note["id"]: self.open_note(i)
            )

            btn.pack(fill="x", pady=5)



    def open_note(self, note_id):

        note = self.note_service.get_note(note_id)

        if not note:
            return

        editor = self.master.editor

        editor.title.delete(0, "end")
        editor.textbox.delete("1.0", "end")

        editor.title.insert(0, note["title"])
        editor.textbox.insert("1.0", note["content"])

        editor.current_note_id = note_id

        updated = note.get("updated_at")

        if updated:
            relative = self.note_service.get_relative_time(updated)
            editor.modified_label.configure(text=f"Last modified: {relative}")
        else:
            editor.modified_label.configure(text="")

