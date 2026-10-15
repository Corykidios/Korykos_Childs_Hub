import customtkinter as ctk
from presentation.sidebar import Sidebar
from presentation.editor import Editor

ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("dark-blue")

class App(ctk.CTk):
    def __init__(self, note_service):
        super().__init__()

        #window settings:
        self.title("ONB")
        self.geometry("900x600")

        self.sidebar = Sidebar(self, note_service)
        self.editor = Editor(self, note_service)

    def refresh_sidebar(self):
        self.sidebar.refresh_notes()

