from flask import Flask, send_from_directory
app = Flask(__name__, static_url_path='')

import pymongo
client = pymongo.MongoClient()
db = client.test_database
usgs_stats = db.usgs_stats

from bson import json_util

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/stats/<month>/<day>')
def get_stats(month, day):
    result = usgs_stats.find({"month":month, "day":day})
    json_result = json_util.dumps(result)
    return json_result

if __name__ == '__main__':
    app.run()
