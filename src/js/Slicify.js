/**
 * Chunk's template
 */
class Chunk {




    /**
     * Constructor
     *
     * @param name
     * @param totalFileSize
     * @param startPoint
     * @param endPoint
     * @param data
     */
    constructor(name, totalFileSize, startPoint, endPoint, data) {

        // File's name
        this.name = name;

        // Total file's size
        this.totalFileSize = totalFileSize;

        // Start point
        this.startPoint = startPoint;

        // End point
        this.endPoint = endPoint;

        // Chunk's data
        this.data = data;

    }




    /**
     * Rename current chunk
     *
     * @param name
     * @returns {Chunk}
     */
    rename(name) {
        this.name = name;
        return this;
    }
}




/**
 * The ChunkRepository class can be used to create file's chunks.
 */
class ChunkRepository {




    /**
     * Constructor
     *
     * @param file
     */
    constructor(file) {
        this.file = file;
    }




    /**
     * Fetch a piece of file and return it in chunk template
     *
     * @param start
     * @param length
     * @returns {Chunk}
     */
    fetch(start, length) {
        let file = this.file;

        if(start < 0)
            start = 0;

        // Determine end point
        let end = start + length;
        if(file.size < end)
            end = file.size;

        let slice = this._slice(file,start, end);

        // convert Blob to a real file
        if (file.name && typeof File !== "undefined") {
            try {
                slice = new File([slice], file.name , {type: file.type});
            } catch(e) {
                // return to blob : File not supports
                slice = this._slice(file,start, end);
            }
        }

        return new Chunk(
            file.name,
            file.size,
            start,
            end,
            slice
        );
    }




    /**
     * Create slice of file.
     *
     * @param file
     * @param start
     * @param end
     * @returns {*}
     * @private
     */
    _slice(file, start, end) {
        let slice = file.mozSlice ? file.mozSlice :
            file.webkitSlice ? file.webkitSlice :
                file.slice ? file.slice : (() => {throw new Error('your browser not support file.slice')});
        return slice.bind(file)(start, end, file.type);
    }
}





/**
 * The Emitter class provides the ability to call `.on()` listen to events.
 * It is strongly based on component's emitter class, and I removed the
 * functionality because of the dependency hell with different frameworks.
 */
class Emitter {




    /**
     * Add an event listener for given event.
     *
     * @param event
     * @param fn
     * @returns this
     */
    on(event, fn) {
        this._callbacks = this._callbacks || {};
        // Create namespace for this event.
        if (!this._callbacks[event]) {
            this._callbacks[event] = [];
        }
        if(fn)
            this._callbacks[event].push(fn);
        return this;
    }





    /**
     * Trigger an event.
     *
     * @param event
     * @param args
     * @returns this
     */
    emit(event, ...args) {
        this._callbacks = this._callbacks || {};
        let callbacks = this._callbacks[event];
        if (callbacks) {
            for (let callback of callbacks) {
                callback.apply(this, args);
            }
        }
        return this;
    }





    /**
     * Remove event listener for given event. If fn is not provided, all event
     * listeners for that event will be removed. If neither is provided, all
     * event listeners will be removed.
     *
     * @param event
     * @param fn
     * @returns this
     */
    off(event, fn) {
        if (!this._callbacks || (arguments.length === 0)) {
            this._callbacks = {};
            return this;
        }

        // Specific event:
        let callbacks = this._callbacks[event];
        if (!callbacks) {
            return this;
        }

        // Remove all handlers:
        if (arguments.length === 1) {
            delete this._callbacks[event];
            return this;
        }

        // Remove specific handler:
        for (let i = 0; i < callbacks.length; i++) {
            let callback = callbacks[i];
            if (callback === fn) {
                callbacks.splice(i, 1);
                break;
            }
        }

        return this;
    }
}


class Form {




    /**
     * Constructor
     *
     * @param action
     * @param method
     */
    constructor(action, method = 'POST') {
        this.fields = {};
        this.headers = {};

        this.action = action;
        this.method = method;

        this.withCredentials = false;
        this.timeout = 3000;
    }




    /**
     * Add a field.
     *
     * @param name
     * @param value
     * @returns this
     */
    addField(name, value) {
        this.fields[name] = value;

        return this;
    }




    /**
     * Determine if a field exists.
     *
     * @param name
     * @returns {boolean}
     */
    hasField(name){
        return this.fields.hasOwnProperty(name);
    }




    /**
     * Rename a Field.
     *
     * @param newName
     * @param name
     * @returns this
     */
    renameField(newName,name) {
        if(this.hasField(name)) {
            this.fields[newName] = this.fields[name];
            delete this.fields[name];
        }

        return this;
    }




    /**
     * Add custom headers.
     *
     * @param name
     * @param value
     * @returns this
     */
    addHeaders(name,value) {
        this.headers[name] = value;
        return this;
    }




    /**
     * Submit form.
     *
     * @returns {Promise<any>}
     */
    submit() {
        let form = new FormData();

        Object.keys(this.fields).forEach((name) => {
            form.append(name,this.fields[name]);
        });

        return new Promise((resolve, reject) => {
            let xhr = new XMLHttpRequest();
            xhr.withCredentials = this.withCredentials;
            xhr.timeout = this.timeout;
            if(this.headers.length) {
                this.headers.forEach((name) => {
                    request.setRequestHeader(name,this.headers(name));
                });
            }
            xhr.open(this.method, this.action ,true);
            xhr.onload = () => resolve(xhr.responseText);
            xhr.onerror = () => reject(xhr.statusText);
            xhr.send(form);
        });
    }

    /**
     * Reset the form fields.
     *
     * @returns this
     */
    reset() {
        this.fields = {};

        return this;
    }
}

/**
 * Handle file's slice upload.
 * (chunk uploading system)
 */
class Slicify extends Emitter{




    /**
     * Constructor
     *
     * @param options
     */
    constructor(options = null) {
        super();

        // Statuses
        this.ADDED = "added";
        this.QUEUED = "queued";
        this.UPLOADING = "uploading";
        this.PAUSED = "paused";
        this.ERROR = "error";
        this.SUCCESS = "success";

        // Events
        this.events = [
            "addedfiles",
            "addedfile",
            "removedfile",
            "error",
            "statuschanged",
            "processing",
            "sending",
            "success",
            "paused",
            "resumed",
            "reset",
            "maxfilesexceeded",
            "maxfilesreached",
            "queuecomplete"
        ];

        // Files
        this.files = [];

        // Load default options
        this.options = this.defaultOptions();

        // Set given options
        if(options)
            this.setOptions(options);

        this._setupEventListeners();

        setInterval(() => {
            this._process();
        }, 1000);
    }




    /**
     * Return default options.
     */
    defaultOptions() {
        return {

            /**
             * Has to be specified on elements other than form (or when the form
             * doesn't have an `action` attribute).
             */
            url: null,

            /**
             * Can be changed to `"put"` if necessary
             */
            method: "POST",

            /**
             * Name of the file param that gets transferred.
             */
            paramName: "file",

            /**
             * Max waiting time for response (milli-seconds)
             */
            timeout: 3000,

            /**
             * Use credentials or not
             */
            withCredentials : false,

            /**
             * Whether a chunk should be retried if it fails.
             */
            retryChunks: true,

            /**
             * If `retryChunks` is true, how many times should it be retried.
             */
            retryChunksLimit: 3,

            /**
             * Max number of files can be processed in queue at the same time.
             */
            parallelUploads: 3,

            /**
             * Max chunk size (bytes).
             */
            chunkSize: 500*(1024), // 500KB

            /**
             * Max file size (bytes).
             */
            maxFileSize: 10*(1024*1024), // 10MB

            /**
             * Max number of files can be uploaded without error.
             */
            maxFiles: null,

            /**
             * Can be used to add some custom headers in HTTP requests.
             */
            headers: null,

            /**
             * Accepted file mime types (example : images/*).
             */
            acceptedFiles: null,

            /**
             * If `true` , files will be pushed into queue automatically.
             */
            autoQueue: true,

            /**
             * A value or method can be used to rename chunks before uploading.
             */
            renameChunk: null,

            /**
             * Translations. (for multi-lingual usage)
             */

            dictFileTooBig: "File is too big ({{fileSize}}MiB). Max fileSize: {{maxFileSize}}MiB.",

            dictInvalidFileType: "You can't upload files of this type.",

            dictResponseError: "Server responded with {{statusCode}} code.",

            dictMaxFilesExceeded: "You can not upload any more files.",

            dictFileSizeUnits: {b:'Bytes', kb:'KB', mb:'MB', gb:'GB', tb:'TB', pb:'PB', eb:'EB', zb:'ZB', yb:'YB'},

        };
    }




    /**
     * Modify given options.
     *
     * @param options
     * @returns {Manager}
     */
    setOptions(options) {
        for(let option in options) {
            this.options[option] = options[option];
        }
        return this;
    }




    /**
     * Validate file's size
     *
     * @param file
     * @param maxFileSize
     * @returns {boolean}
     */
    isValidFileSize(file, maxFileSize = null) {
        // If there is no maxFileSize , it's OK
        if(!maxFileSize)
            return true;
        return (file.size > maxFileSize);
    }




    /**
     * Validate file's type.
     *
     * @param file
     * @param acceptedFiles
     * @returns {boolean}
     */
    isValidFileType(file, acceptedFiles = null) {
        if (!acceptedFiles) { // If there are no accepted mime types, it's OK
            return true;
        }

        acceptedFiles = acceptedFiles.split(",");

        let mimeType = file.type;
        let baseMimeType = mimeType.replace(/\/.*$/, "");

        for (let validType in acceptedFiles) {
            validType = acceptedFiles[validType].trim();
            if (validType.charAt(0) === ".") {
                if (file.name.toLowerCase().indexOf(validType.toLowerCase(), file.name.length - validType.length) !== -1) {
                    return true;
                }
            } else if (/\/\*$/.test(validType)) {
                // This is something like a image/* mime type:
                if (baseMimeType === validType.replace(/\/.*$/, "")) {
                    return true;
                }
            } else {
                if (mimeType === validType) {
                    return true;
                }
            }
        }

        return false;
    }




    /**
     * Retrieve files by status.
     *
     * @param status
     */
    getFilesByStatus(...status) {
        return this.files.filter((file) => (status.indexOf( file.status ) >= 0));
    }




    /**
     * Retrieve valid files that has no errors
     *
     * @returns {*}
     */
    getAcceptedFiles() {
        return this.getFilesByStatus(
            this.ADDED,
            this.QUEUED,
            this.UPLOADING,
            this.PAUSED,
            this.SUCCESS
        );
    }




    /**
     * Clear file's error.
     *
     * @param file
     * @param status
     * @returns this
     */
    clearErrors(file, status = null) {
        file.errorMessage = null;
        file.chunkRetries = 0;
        this.emit('statuschanged', file, (status || this.PAUSED ));

        return this;
    }




    /**
     * Setup event listeners.
     *
     * @returns this
     * @private
     */
    _setupEventListeners() {

        // Main listeners list
        let listeners = {

            /**
             * Add files.
             *
             * @param files
             */
            addedfiles: (files) => {
                this._addFiles( files );
            },

            /**
             * Add file.
             *
             * @param file
             */
            addedfile: (file) => {
                this._addFile(file);
            },

            /**
             * Remove the given file from upload process.
             *
             * @param file
             */
            removedfile: (file) => {
                this._removeFile(file);
            },

            /**
             * Handle errors
             *
             * @param file
             * @param message
             */
            error: (file,message) => {
                this._setError(file,message);
            },

            /**
             * Handle status changing.
             *
             * @param file
             * @param status
             */
            statuschanged: (file,status) => {
                this._setStatus(file,status);
            },

            /**
             * Do the process.
             *
             * @param file
             */
            processing: (file, chunk) => {
                let form = new Form(this.options.url, this.options.method);

                form.withCredentials = this.options.withCredentials;

                if(this.options.timeout)
                    form.timeout = parseInt(this.options.timeout);

                Object.keys(chunk).forEach((property) => {
                    form.addField(property,chunk[property]);
                });

                if(this.options.paramName)
                    form.renameField(this.options.paramName , 'data');

                if(this.options.headers) {
                    for(let header in this.options.headers) {
                        request.addHeaders(header,this.options.headers[header]);
                    }
                }

                this.emit('sending', file, form);
            },

            /**
             * Handle the Upload requests.
             *
             * @param form
             */
            sending: (file, form) => {
                // Prevent from sending empty blocks
                if(file.size <= file.startPoint){
                    this.emit('statuschanged', file, this.SUCCESS);
                    return;
                }

                form.submit()
                    .then((response) => { // Chunk has been uploaded successfully
                    if(response.length) {
                        try {
                            let response = JSON.parse(response);
                            Object.keys(response).forEach((key) => {
                                if(response.error)
                                    this.emit('error',file,response.error);
                                else
                                    file[key] = response[key];
                            });
                        } catch(e) {
                            console.log('error on json response:' + e);
                        }
                    }

                    if(file.status != this.ERROR) {
                        // Update status
                        if(file.size <= file.startPoint)
                            this.emit('statuschanged', file, this.SUCCESS);
                        else
                            // Reset retries
                            this.clearErrors(file,this.UPLOADING);

                        // Update pointer
                        file.startPoint += this.options.chunkSize;
                    }
                }).catch( (status) => { // Chunk upload has been failed
                    // Set file's status equal to error if number of retries exceeded,
                    // or increase retries count.
                    if(this.options.retryChunks && file.chunkRetries <= this.options.retryChunksLimit) {
                        file.chunkRetries++;
                    } else {
                        this.emit(
                            'error',
                            file,
                            this.options.dictResponseError.replace("{{statusCode}}", status)
                        );
                        // Reset retries
                        file.chunkRetries = 0;
                    }
                });

            },

            /**
             * Finalize the upload process for given file
             * when it has been finished successfully.
             *
             * @param file
             */
            success: (file) => {
                this.emit('statuschanged', file, this.SUCCESS);
            },

            /**
             * Pause given file's uploading process.
             *
             * @param file
             */
            paused: (file) => {
                this._pause(file);
            },

            /**
             * Resume the uploading process for given file
             *
             * @param file
             */
            resumed: (file) => {
                this._resume(file);
            },

            /**
             * Reset every thing to from the beginning.
             */
            reset: () => {
                this._reset();
            }
        };

        // Setup main listeners
        for(let listener in listeners) {
            this.on(listener, listeners[listener]);
        }


        // Setup user's custom event listeners.
        this.events.forEach(event => {
            if(this.options[event])
                this.on(event, this.options[event]);
        });

        return this;
    }




    /**
     * Handle files.
     *
     * @returns this
     * @private
     */
    _process() {
        // Retrieve queued files
        let queuedFiles = this.getFilesByStatus(this.QUEUED,this.UPLOADING);
        // Count queued files
        let queuedFilesCount = queuedFiles.length;

        // Move files into queue (if autoQueue is active)
        if(this.options.autoQueue == true && queuedFilesCount < this.options.parallelUploads) {
            let addedFiles = this.getFilesByStatus(this.ADDED);
            for(let file in addedFiles) {
                addedFiles[file].status = this.QUEUED;
                if(--queuedFilesCount <= 0)
                    break;
            }
        }

        // Upload queued files:
        queuedFiles.forEach((file) => {

            // Get a chunk:
            let chunk = ((new ChunkRepository(file.data)).fetch(
                file.startPoint,
                this.options.chunkSize
            ));

            // Rename chunks if needed:
            if(typeof this.options.renameChunk == "function")
                chunk.rename(this.options.renameChunk.call(null,file));
            else if(this.options.renameChunk)
                chunk.rename(this.options.renameChunk);

            this.emit('processing', file, chunk);

        });

        if(queuedFiles.length <=0)
            this.emit('queuecomplete', queuedFiles);

        return this;
    }




    /**
     * Add files into file's array
     *
     * @param files
     * @returns this
     * @private
     */
    _addFiles(files) {
        if(!(files instanceof Array)) {
            files = Array.from(files);
        }

        files.forEach((file) => {
            this.emit('addedfile',file);
        });

        return this;
    }




    /**
     * Add a file into file's array
     *
     * @param file
     * @returns this
     * @private
     */
    _addFile(file) {
        let startPoint = parseInt(file.startPoint || 0);
        let chunkRetries = parseInt(file.chunkRetries || 0);

        // Remove unwanted keys:
        delete file.startPoint;
        delete file.chunkRetries;

        // Create an object template for given file:
        let data = {
            name: file.name,
            size: file.size,
            type: file.type,
            startPoint: startPoint,
            chunkRetries: chunkRetries,
            status: this.ADDED,
            data: file
        };


        if (this.isValidFileSize(file, this.options.maxFileSize)) { // Validate file's size:

            let message = this.options.dictFileTooBig.replace(
                "{{fileSize}}",
                Math.round(file.size / 1024 / 10.24) / 100
            ).replace(
                "{{maxFileSize}}",
                Math.round(this.options.maxFileSize / 1024 / 10.24) / 100
            );

            this.emit('error', data, message);

        } else if (!this.isValidFileType(file, this.options.acceptedFiles)) { // Validate file type

            let message = this.options.dictInvalidFileType;

            this.emit('error', data, message);

        } else if ((this.options.maxFiles != null) && (this.getAcceptedFiles().length >= this.options.maxFiles)) {

            // If maxFileExceeded we can't add more files:
            let message = this.options.dictMaxFilesExceeded.replace("{{maxFiles}}", this.options.maxFiles);
            this.emit('maxfilesexceeded',data);
            this.emit('error',data, message);

        } else { // If file not found:
            if(!(data.data instanceof File))
                this.emit('statuschanged', data, this.PAUSED);
        }

        this.files.push(data);

        if(this.getAcceptedFiles().length == this.options.maxFiles)
            this.emit('maxfilesreached',data);

        return this;
    }




    /**
     * Handle remove file.
     *
     * @param file
     * @returns this
     * @private
     */
    _removeFile(file) {
        let index = this.files.indexOf(file);
        if(index >= 0) {
            this.files.splice(index, 1);
        }

        return this;
    }



    /**
     * Set file's error
     *
     * @param file
     * @param message
     * @returns this
     * @private
     */
    _setError(file, message) {
        this.emit('statuschanged', file, this.ERROR);
        file.errorMessage = message;

        return this;
    }




    /**
     * Set file's status
     *
     * @param file
     * @param status
     * @returns this
     * @private
     */
    _setStatus(file, status) {
        if(file.status != status) {
            file.status = status;
        }

        return this;
    }




    /**
     * Handle pause.
     *
     * @param file
     * @returns this
     * @private
     */
    _pause(file) {
        this.emit('statuschanged', file, this.PAUSED);

        return this;
    }




    /**
     * Handle resume file.
     *
     * @param file
     * @returns this
     * @private
     */
    _resume(file) {
        if(file.data instanceof File) {
            this.emit('statuschanged', file, this.QUEUED);
        } else {
            let fileElement = document.createElement('input');
            fileElement.type = 'file';
            fileElement.name = this.options.paramName;
            fileElement.accept = this.options.acceptedFiles;
            fileElement.addEventListener('change',() => {
                if(fileElement.files[0].size == file.size) {
                    file.data = fileElement.files[0];
                    this.emit('statuschanged', file, this.QUEUED);
                } else {
                    alert('selected file must be the same as the un-complete uploaded file.');
                }
            },false);
            // Trigger file input
            fileElement.click();
        }

        return this;
    }




    /**
     * Reset every thing.
     *
     * @returns this
     * @private
     */
    _reset() {
        this.files = [];

        return this;
    }




    /**
     * Convert bytes to human readable format.
     *
     * @param bytes
     * @param precise
     * @returns {string}
     */
    formatBytes(bytes, precise = 2) {
        let sizes = ['b', 'kb', 'mb', 'gb', 'tb', 'pb', 'eb', 'zb', 'yb'];
        if(bytes == 0) return '0 '+(this.options.dictFileSizeUnits[sizes[0]] || sizes[0]);
        let k = 1024,
            dm = precise <= 0 ? 0 : precise || 2,
            i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + (this.options.dictFileSizeUnits[sizes[i]] || sizes[i]);
    }




    /**
     * Determine the upload percent for given file
     *
     * @param file
     * @returns {number}
     */
    getUploadedPercent(file) {
        if(!file.startPoint || !file.size)
            return 0;

        return Math.min( Math.floor((file.startPoint/file.size)*100) ,100);
    }
}