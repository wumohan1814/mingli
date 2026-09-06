import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'packages'))
from app.main import app
print("App loaded OK")
print("Routes:", [r.path for r in app.routes])
