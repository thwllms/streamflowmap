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

@app.route('/stats/<month>/<day>/<param>')
def get_stats(month, day, param):
    result = usgs_stats.find_one({"month":month, "day":day, "param":param})
    json_result = json_util.dumps(result)
    return json_result

if __name__ == '__main__':
    app.run()
