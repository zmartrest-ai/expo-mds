import ExpoModulesCore

public class ExpoMdsModule: Module {
    lazy var mds = MdsService()
  // Each module class must implement the definition function. The definition consists of components
  // that describes the module's functionality and behavior.
  // See https://docs.expo.dev/modules/module-api for more details about available components.
  public func definition() -> ModuleDefinition {
    // Sets the name of the module that JavaScript code will use to refer to the module. Takes a string as an argument.
    // Can be inferred from module's class name, but it's recommended to set it explicitly for clarity.
    // The module will be accessible from `requireNativeModule('ExpoMds')` in JavaScript.
    Name("ExpoMds")

    // Defines event names that the module can send to JavaScript.
    Events("newScannedDevice", "newNotification", "newNotificationError")

    // Defines a JavaScript synchronous function that runs the native code on the JavaScript thread.
    Function("scan") {
        func handleScannedDevice(device: MovesenseDevice) {
            let deviceSend = ["name": device.localName, "address": device.uuid.uuidString] as [String : Any]
            self.sendEvent( "newScannedDevice", deviceSend )
      
        }
        self.mds.startScan({device in handleScannedDevice(device: device)}, {})
    }
      
      Function("stopScan") {
          self.mds.stopScan()
      }
      
      Function("unsubscribe") { (uri: String) in
        self.mds.unsubscribe(uri)
      }
      
      
      Function("connect") { (address: String) in
        // Send an event to JavaScript.
        self.mds.connectDevice(address)
      }
      
      Function("disconnect") { (address: String) in
        // Send an event to JavaScript.
        self.mds.disconnectDevice(address)
      }
      
      AsyncFunction("get") { (uri: String,
                         parameters: Dictionary<String, Any>, promise: Promise) in
        // Send an event to JavaScript.
          self.mds.get(uri, parameters, { response in
              promise.resolve(response)
          }, { e in
              promise.reject("MdsError", e)
          })
      }
      
      AsyncFunction("post") { (uri: String,
                         parameters: Dictionary<String, Any>, promise: Promise) in
        // Send an event to JavaScript.
          self.mds.post(uri, parameters, { response in
              promise.resolve(response)
          }, { e in
              promise.reject("MdsError", e)
          })
      }
      
      AsyncFunction("put") { (uri: String,
                         parameters: Dictionary<String, Any>, promise: Promise) in
        // Send an event to JavaScript.
          self.mds.put(uri, parameters, { response in
              promise.resolve(response)
          }, { e in
              promise.reject("MdsError", e)
          })
      }
      
      AsyncFunction("delete") { (uri: String,
                         parameters: Dictionary<String, Any>, promise: Promise) in
        // Send an event to JavaScript.
          self.mds.del(uri, parameters, { response in
              promise.resolve(response)
          }, { e in
              promise.reject("MdsError", e)
          })
      }
      
      Function("subscribe") { (uri: String,
                               parameters: Dictionary<String, Any>, key: String) in
        // Send an event to JavaScript.
          self.mds.subscribe(uri, parameters: parameters, onNotify: { notification in
              self.sendEvent("newNotification", [
                "notification": notification,
                "key": key
              ])
          }, onError: { (uri, error) in
              self.sendEvent("newNotificationError", [
                "uri": uri,
                                                    "error": error,
                                                    "key": key])
          })
      }
  }
}
