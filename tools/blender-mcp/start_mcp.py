import bpy
def _start():
    try:
        bpy.ops.blendermcp.start_server()
        print("MCP SOCKET SERVER STARTED on 9876")
    except Exception as e:
        print("START FAIL:", e)
    return None
bpy.app.timers.register(_start, first_interval=1.0)
