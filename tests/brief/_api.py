import http.cookiejar
import json
import os
import urllib.error
import urllib.request

BASE_URL = os.environ.get("NIGHTINGALE_BASE_URL", "http://127.0.0.1:3100")


class ApiClient:
    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def request(self, method, path, body=None):
        data = None if body is None else json.dumps(body).encode("utf-8")
        headers = {"Content-Type": "application/json"} if body is not None else {}
        request = urllib.request.Request(BASE_URL + path, data=data, headers=headers, method=method)
        try:
            with self.opener.open(request, timeout=10) as response:
                payload = json.loads(response.read().decode("utf-8"))
                return response.status, payload
        except urllib.error.HTTPError as error:
            payload = json.loads(error.read().decode("utf-8"))
            return error.code, payload

    def login(self, user_id):
        status, payload = self.request("POST", "/api/session", {"userId": user_id})
        if status != 200:
            raise AssertionError((status, payload))
        return payload


def client_for(user_id):
    client = ApiClient()
    client.login(user_id)
    return client
