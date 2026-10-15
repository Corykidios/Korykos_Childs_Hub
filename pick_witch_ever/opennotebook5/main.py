from presentation.app import App
from core.note_service import NoteService

if __name__ == "__main__":
    note_service = NoteService()
    app = App(note_service)
    app.mainloop()
