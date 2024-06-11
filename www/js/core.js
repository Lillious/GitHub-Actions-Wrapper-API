const workflowSelect = document.getElementById('workflow-select');
const repoSelect = document.getElementById('repo-select');
const repoSuccessIcon = document.getElementById('repo-success-icon');
const repoCancelIcon = document.getElementById('repo-cancel-icon');
const repoLoadingIcon = document.getElementById('repo-loading-icon');
const workflowSuccessIcon = document.getElementById('workflow-success-icon');
const workflowCancelIcon = document.getElementById('workflow-cancel-icon');
const workflowLoadingIcon = document.getElementById('workflow-loading-icon');
const outputDisplay = document.getElementById('output-container');
const inputs = document.getElementById('inputs');
const inputcontainer = document.getElementById('inputs-container');
const button = document.getElementById('start-workflow');
const timer = document.getElementById('timer');
const progress = document.getElementById('progress');
const statusText = document.getElementById('status-text');
const cancelRun = document.getElementById('workflow-cancel-run-icon');
const extendLogsLeft = document.getElementById('extend-logs-left');
const extendLogsRight = document.getElementById('extend-logs-right');
const logs = document.getElementById('logs-container');
const logsobject = document.getElementById('logs');
repoCancelIcon.style.display = 'none';
repoSuccessIcon.style.display = 'none';
repoLoadingIcon.style.display = 'inline';
repoSelect.disabled = true;
workflowSelect.disabled = true;
let statusInterval;
let timerInterval;
let workflowid;

// Check resolution every time the window is resized
window.addEventListener('resize', function() {
    const documentWidth = document.body.clientWidth;
    if (documentWidth < 750) {
        logs.style.left = '250px';
        extendLogsLeft.style.display = 'inline';
        extendLogsRight.style.display = 'none';
    } else {
        logs.style.left = '250';
        extendLogsLeft.style.display = 'none';
        extendLogsRight.style.display = 'none';
    }
});

extendLogsLeft.addEventListener('click', function() {
    const documentWidth = document.body.clientWidth;
    const diff = documentWidth / 4;
    logs.style.transition = 'left 0.5s';
    logs.style.left = `${diff}px`;
    extendLogsLeft.style.display = 'none';
    extendLogsRight.style.display = 'inline';
});

extendLogsRight.addEventListener('click', function() {
    logs.style.transition = 'left 0.5s';
    logs.style.left = '250px';
    extendLogsRight.style.display = 'none';
    extendLogsLeft.style.display = 'inline';
});

function disableAllInput () {
    button.disabled = true;
    workflowSelect.disabled = true;
    repoSelect.disabled = true;
    let inputs = document.getElementsByClassName('input');
    for (let input of inputs) {
        input.disabled = true;
    }
}

function enableAllInput () {
    button.disabled = false;
    workflowSelect.disabled = false;
    repoSelect.disabled = false;
    let inputs = document.getElementsByClassName('input');
    for (let input of inputs) {
        input.disabled = false;
    }
}

async function getRepositories () {
    const response = await fetch('http://localhost:8080/api/repositories',
    {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    }).catch((error) => {
        repoLoadingIcon.style.display = 'none';
        repoCancelIcon.style.display = 'inline';
        repoSuccessIcon.style.display = 'none';
        Notify('error', 'Failed to fetch repositories');
        return;
    });

    return response;
}

async function getWorkflows(username = getUsername(), repo = getRepo()) {
    const response = await fetch(`http://localhost:8080/api/workflows?owner=${username}&repo=${repo}`,
    {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    }).catch((error) => {
        workflowLoadingIcon.style.display = 'none';
        workflowSuccessIcon.style.display = 'none';
        workflowCancelIcon.style.display = 'inline';
        Notify('error', 'Failed to fetch workflows');
        return;
    });

    return response;
}

async function getWorkflowInputs(username = getUsername(), repo = getRepo(), workflow = getWorkflow()) {
    const reponse = await fetch(`http://localhost:8080/api/workflow/inputs?owner=${username}&repo=${repo}&workflow=${workflow}`,
    {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    }).catch((error) => {
        workflowLoadingIcon.style.display = 'none';
        workflowCancelIcon.style.display = 'inline';
        workflowSuccessIcon.style.display = 'none';
        // Set the button to disabled
        button.disabled = true;
        // Set the workflowselect value to 0
        workflowSelect.value = '0';
        Notify('error', 'Failed to fetch inputs');
        return;
    });

    return reponse;
}

async function getWorkflowRuns(result) {
    const response = await fetch('http://localhost:8080/api/workflow',
    {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(
            {
                "owner": getUsername(),
                "repo": getRepo(),
                "workflow_id": getWorkflow(),
                "ref": "main",
                "inputs": result
            }
        )
    }).catch((error) => {
        enableAllInput();
        Notify('error', 'Failed to start workflow');
        return;
    });

    return response;
}

async function getJobs(id) {
    const response = await fetch(`http://localhost:8080/api/run/jobs?owner=${getUsername()}&repo=${getRepo()}&workflow=${getWorkflow()}&id=${id}`,
    {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    })

    return response;
}

async function getStatus(run_id) {
    const response = await fetch(`http://localhost:8080/api/run/status?owner=${getUsername()}&repo=${getRepo()}&run_id=${run_id}`,
    {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    }).catch((error) => {
        clearInterval(statusInterval);
        clearInterval(timerInterval);
        statusText.textContent = 'Connection Error';
        progress.style.backgroundColor = 'tomato';
        enableAllInput();
        return;
    });

    return response;
}

async function forceCancelRun(run_id) {
    const response = await fetch(`http://localhost:8080/api/run/cancel/`,
    {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(
            {
                "owner": getUsername(),
                "repo": getRepo(),
                "run_id": run_id
            }
        )
    }).then((response) => {
        if (response.ok) {
            Notify('info', 'Attempting to cancel workflow');
        }
    }).catch((error) => {
        return;
    });

    return response;
}

// Cancel run event listener
cancelRun.addEventListener('click', async function() {
    // Ensure the workflow is in the in_progress state
    if ((statusText.textContent !== 'In Progress' && statusText.textContent !== 'Queued') || !workflowid) {
        Notify('error', 'Workflow is not in progress');
        return;
    }

    await forceCancelRun(workflowid);         
});

async function fetchLogs(run_id) {
    const response = await fetch(`http://localhost:8080/api/run/logs?owner=${getUsername()}&repo=${getRepo()}&run_id=${run_id}`,
    {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    }).catch((error) => {
        return;
    });

    return response;
}

function getUsername() {
    const username = repoSelect.value.split('/')[0] ? repoSelect.value.split('/')[0] : '';
    return username;
}

function getRepo() {
    const repo = repoSelect.value.split('/')[1] ? repoSelect.value.split('/')[1] : '';
    return repo;
}

function getWorkflow() {
    const workflow = workflowSelect.value ? workflowSelect.value : '';
    return workflow;
}

// Anonymous async function
(async function() {
    // Fetch repositories
    const repositories = await getRepositories();
    const repositoriesData = await repositories.json();
    const repositoryList = repositoriesData.repositories.sort((a, b) => a.localeCompare(b));

    // If there are no repositories, show an error message
    if (!repositories.ok) {
        repoLoadingIcon.style.display = 'none';
        repoCancelIcon.style.display = 'inline';
        Notify('error', 'No repositories found');
        return;
    }

    // Add repositories to the repository select
    for (let repo of repositoryList) {
        const option = document.createElement('option');
        option.text = repo;
        repoSelect.add(option);
    }

    // Enable the repository select and hide the loading icon
    repoLoadingIcon.style.display = 'none';
    repoSuccessIcon.style.display = 'inline';
    repoSelect.disabled = false;

    // Add event listeners to the repository select
    repoSelect.addEventListener('change', async function() {
        // Clear the workflow select
        workflowSelect.innerHTML = '';
        // Clear the inputs
        inputs.innerHTML = '';
        // Hide the inputs section
        inputcontainer.style.display = 'none';

        // Add a blank value to the workflow select
        const blank_value = `
            <option default value="0">None</option>
        `
        workflowSelect.innerHTML += blank_value;

        // Disable the workflow select, hide the success icon and show the loading icon
        workflowSelect.disabled = false;
        workflowSuccessIcon.style.display = 'none';
        workflowCancelIcon.style.display = 'none';
        workflowLoadingIcon.style.display = 'inline';

        // Fetch workflows
        const workflows = await getWorkflows();

        // If there are no workflows, show an error message
        if (!workflows.ok) {
            workflowLoadingIcon.style.display = 'none';
            workflowCancelIcon.style.display = 'inline';
            button.disabled = true;
            Notify('error', 'No workflows found for this repository');
            return;
        }

        const workflowsData = await workflows.json();
        const workflowsList = workflowsData.workflows.sort((a, b) => a.localeCompare(b));

        // Add workflows to the workflow select
        for (let workflow of workflowsList) {
            const element = `
                <option value="${workflow}">${workflow}</option>
            `
            workflowSelect.innerHTML += element;
        }

        // Enable the workflow select and hide the loading icon
        workflowLoadingIcon.style.display = 'none';
        workflowSuccessIcon.style.display = 'inline';
        workflowSelect.disabled = false;
    });

    // Add event listener to the workflow select
    workflowSelect.addEventListener('change', async function() {
        // Get the workflow inputs and display them
        inputs.innerHTML = '';
        inputcontainer.style.display = 'none';
        workflowLoadingIcon.style.display = 'inline';
        workflowSuccessIcon.style.display = 'none';
        workflowCancelIcon.style.display = 'none';

        if (workflowSelect.value === '0') {
            workflowLoadingIcon.style.display = 'none';
            workflowCancelIcon.style.display = 'inline';
            button.disabled = true;
            return;
        }

        const workflowInputsData = await getWorkflowInputs();
    
        const workflowInputData = await workflowInputsData.json();
        const workflowInputs = workflowInputData.inputs;

        if(workflowInputs) {
            // Show the inputs section
            inputcontainer.style.display = 'block';

            // Add the inputs to the inputs section
            for (let input of workflowInputs) {
                let name = input.name;
                let description = input.description;
                let required = input.required;
                if (required) {
                    name = `${name} *`;
                }
                let type = input.type;
                let element = `
                    <div class="section">
                        <p class="input-name">${name}</p>
                        <p class="input-description">${description}</p>
                    `

                // Get input types and create input elements accordingly
                if (type === 'string') {
                    let default_value = input.default ? input.default : 'String Value';
                    element += `
                            <input type="text" class="input" placeholder="${default_value}" required=${required}>
                        </div>
                    `
                }

                if (type === 'number') {
                    let default_value = input.default ? input.default : '0';
                    element += `
                            <input type="number" class="input" placeholder="${default_value}" required=${required}>
                        </div>
                    `
                }

                if (type === 'boolean') {
                    element += `
                            <input type="checkbox" class="input" required=${required}>
                            <label for="boolean" class="input-label">True</label>
                        </div>
                    `
                }

                inputs.innerHTML += element;
            }
        }

        // Enable the start workflow button and show the success icon
        workflowLoadingIcon.style.display = 'none';
        workflowSuccessIcon.style.display = 'inline';
        button.disabled = false;
    });

    button.addEventListener('click', async function() {
        const inputs = document.getElementsByClassName('input');
        // Disable the button and inputs
        disableAllInput();
        let result = {};

        // Get the inputs and their values
        for (let input of inputs) {
            let name = input.previousElementSibling.previousElementSibling.textContent;
            let value = input.value ? input.value : input.checked;
            if (value === 'on') {
                value = true;
            } else if (!value) {
                value = false;
            }

            // Remove the * from the name
            name = name.replace(' *', '');

            result[name] = value;
        }

        // Get the workflow runs
        let workflowRuns = await getWorkflowRuns(result);
    
        if (!workflowRuns.ok) {
            enableAllInput();
            Notify('error', 'Failed to start workflow');
            return;
        }

        // Notify the user that the workflow has started
        Notify('success', 'Workflow started successfully');
        logsobject.innerHTML = '';

        // Get the run id
        const data = await workflowRuns.json();
        const id = data.id;

        outputDisplay.style.display = 'block';
        statusText.textContent = 'Queued';
        progress.style.backgroundColor = '#4193F8';
        progress.style.width = '10%';
        timer.textContent = '00:00:00';
        
        // Timer
        timerInterval = setInterval(async function() {
            // Timer format is 00:00:00
            let time = timer.textContent.split(':');
            let hours = parseInt(time[0]);
            let minutes = parseInt(time[1]);
            let seconds = parseInt(time[2]);

            // Process stops after 45 seconds if it is still queued
            if (seconds >= 45 && statusText.textContent === 'Queued') {
                clearInterval(statusInterval);
                clearInterval(timerInterval);
                statusText.textContent = 'Timed Out';
                enableAllInput();
                progress.style.backgroundColor = 'grey';
                progress.style.width = '100%';
                return;
            }

            seconds += 1;
            if (seconds === 60) {
                seconds = 0;
                minutes += 1;
            }

            if (minutes === 60) {
                minutes = 0;
                hours += 1;
            }

            timer.textContent = `${hours < 10 ? '0' + hours : hours}:${minutes < 10 ? '0' + minutes : minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
        }, 1000);
        
        const jobs = await getJobs(id);
        const jobData = await jobs.json();


        if (!jobs.ok) {
            clearInterval(statusInterval);
            clearInterval(timerInterval);
            statusText.textContent = 'Connection Error';
            progress.style.backgroundColor = 'tomato';
            enableAllInput();
            Notify('error', 'Failed to fetch jobs');
            return;
        }

        workflowid = jobData.job_id;
    
        statusInterval = setInterval(async function() {
            let statusResponse = await getStatus(workflowid);
    
            if (!statusResponse.ok) {
                clearInterval(statusInterval);
                clearInterval(timerInterval);
                statusText.textContent = 'Connection Error';
                progress.style.backgroundColor = 'tomato';
                enableAllInput();
                return;
            }
    
            let statusData = await statusResponse.json();
            let status = statusData.response.status;
            let conclusion = statusData.response.conclusion;

            // If the status is timed out, stop the interval
            if (statusText.textContent === 'Timed Out') {
                enableAllInput();
                return;
            }

            switch (status) {
                case 'queued':
                    // Check if the existing status is in progress
                    if (statusText.textContent === 'In Progress') return;
                    progress.style.width = '10%';
                    statusText.textContent = 'Queued';
                    break;
                case 'in_progress':
                    progress.style.width = '50%';
                    progress.style.backgroundColor = '#fcca26';
                    statusText.textContent = 'In Progress';
                    break;
                case 'completed':
                    switch (conclusion) {
                        case 'success':
                            clearInterval(statusInterval);
                            clearInterval(timerInterval);
                            enableAllInput();
                            progress.style.width = '100%';
                            progress.style.backgroundColor = '#28a745';
                            statusText.textContent = `Completed - ${new Date().toLocaleString()}`;
                            break;
                        case 'failure':
                            clearInterval(statusInterval);
                            clearInterval(timerInterval);
                            enableAllInput();
                            progress.style.width = '100%';
                            progress.style.backgroundColor = 'tomato';
                            statusText.textContent = `Failed - ${new Date().toLocaleString()}`;
                            break;
                        case 'cancelled':
                            clearInterval(statusInterval);
                            clearInterval(timerInterval);
                            Notify('success', 'Cancelled workflow');
                            enableAllInput();
                            progress.style.backgroundColor = 'grey';
                            statusText.textContent = `Cancelled - ${new Date().toLocaleString()}`;
                            break;
                        default:
                            clearInterval(statusInterval);
                            clearInterval(timerInterval);
                            enableAllInput();
                            progress.style.backgroundColor = 'grey';
                            statusText.textContent = 'Unknown';
                            break;
                    }
                    break;
                default:
                    enableAllInput();
                    progress.style.backgroundColor = 'grey';
                    statusText.textContent = 'Unknown';
                    break;
            }
    
            if (status !== 'queued' && status !== 'in_progress') {
                clearInterval(statusInterval);
                clearInterval(timerInterval);
                Notify('info', 'Fetching logs');
                const logsResponse = await fetchLogs(workflowid);
                const logsData = await logsResponse.json();
                const _logs = logsData.logs;
                if (!_logs) {
                    Notify('error', 'Failed to fetch logs');
                    logsobject.innerHTML = '';
                    return;
                }
                _logs.forEach(log => {
                    let formattedLog = log.content.replace(/\n/g, '<br>');
                    // Ready each line in the log
                    formattedLog = formattedLog.split('<br>').map((line) => {
                        if (line !== '') {
                            let firstword = line.split(' ')[0];
                            let date = new Date(firstword).toLocaleString();
                            var newline = line.replace(firstword, '');
                            
                            if (newline.includes('##[error]')) {
                                newline = newline.replace(`##[error]`, 'Error: ');
                                let element = `
                                <div class="log">
                                    <p class="log-date">${date}</p>
                                    <p class="log-content white red-highlight">${newline}</p>
                                </div>
                            `
                            logsobject.innerHTML += element;
                            } else {
                                let element = `
                                <div class="log">
                                    <p class="log-date">${date}</p>
                                    <p class="log-content">${newline}</p>
                                </div>
                            `
                            logsobject.innerHTML += element;
                            }
                        }
                    })
                });

                // Wait 2 seconds before scrolling to the bottom
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Scroll to the element that contains red-highlight if it exists over 1 second
                const redHighlight = document.getElementsByClassName('red-highlight');
                if (redHighlight.length > 0) {
                    // Scroll to 2 elements above the red-highlight element
                    redHighlight[0].scrollIntoView({behavior: 'smooth', block: 'center'});
                } else {
                    logsobject.scrollIntoView({behavior: 'smooth'});
                }
            }
        }, 1000);
    });
})();

function Notify(type, message) {
	const notification = document.createElement("div");
	notification.classList.add("notification");
	notification.classList.add(`notification-${type}`);
	notification.innerHTML = `<p>${message}</p>`;
	document.body.appendChild(notification);

	// Move the notification up if there are other notifications
	const notifications = document.getElementsByClassName("notification");
	for (let i = 0; i < notifications.length; i++) {
		notifications[i].style.marginBottom = `${80 * i}px`;
	}

	setTimeout(() => {
		// Move all notifications up
		const notifications = document.getElementsByClassName("notification");
		for (let i = 0; i < notifications.length; i++) {
			notifications[i].style.marginBottom = `${80 * (i - 1)}px`;
		}
		notification.remove();
	}, 5000);
}