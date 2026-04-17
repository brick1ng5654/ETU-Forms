project = 'ETU Forms Documentation'
copyright = '2026, ETU'
author = 'RLS'

extensions = [
    'myst_parser',
]

templates_path = ['_templates']
exclude_patterns = []

language = 'ru'

html_theme = 'furo'
html_static_path = ['_static']
html_css_files = ['custom.css']
html_show_sphinx = False
html_show_sourcelink = False

# Furo: remove "view this page" / "view source" top-of-page button.
html_theme_options = {
    "top_of_page_buttons": [],
}

source_suffix = {
    '.md': 'markdown',
}

master_doc = 'index'
