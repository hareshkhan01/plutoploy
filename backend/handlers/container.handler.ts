import Docker from 'dockerode';
import Stream from 'stream';
const docker = new Docker();


const portBindings = {
    '3000/tcp' : [{HostPort : '3000'}],
}
//pull the image
const pullImage = async (imagename : string) : Promise<void> => {
    if(imagename == '') return ;
    await docker.pull(imagename, function(err : Error, stream : NodeJS.ReadStream ) {
        docker.modem.followProgress(stream , onProgress, onFinished);
    })

    function onFinished() : [] {
        createContainer();
    }

    function onProgress(){

    }

}




/**
 * build the cintainer
 * @param repourl
 * @param deployid
 */

    const createContainer = async (repoUrl : string, imageName: string, deployid : string) =>{
        //habdle repoerl amnndimage name uissues


        const container = docker.createContainer({
            Image?: imageName,
            AttachStderr: true,
            AttachStdin: false,
            AttachStdout : true,
            Tty:true,
            ExposedPorts : {'80/tcp' : {}},
            HostConfig : {
                PortBindings: portBindings
            },
            // for ci cd memory and cpu credentials
            name: 'test-Container',
        })
    }