const yauzl = require("yauzl");
import path from 'path';
import http from 'http';
import crypto from 'crypto';
import yaml from 'yaml';
import fs from 'fs';
import express from 'express';
export const router = express.Router();

const config = {
    baseUrl: '/api',
    version: '2022-11-28',
    githubApi: 'https://api.github.com',
    token: process.env.GITHUB_TOKEN
};

router.use(`${config.baseUrl}`, (req, res, next) => {
    if (!config.token)
        return res.status(401).send(
            {
                code: 401,
                message: 'No token provided'
            } as ResponseMessage
        );
    next();
});

// Get the status of the API
router.get(`${config.baseUrl}/status`, (req, res) => {
    res.send({
        status: 'OK'
    });
});

// Get all workflows for a repository
router.get(`${config.baseUrl}/workflows`, async (req, res) => {
    let { owner, repo } = req.query as { owner: string, repo: string };

    if (!owner || !repo)
        return res.status(400).send(
            {
                code: 400,
                message: 'owner and repo are required parameters'
            } as ResponseMessage
        );

    let response = await fetch(`${config.githubApi}/repos/${owner}/${repo}/actions/workflows`, {
        method: 'GET',
        headers: {
            "Authorization": `Bearer ${config.token}`,
            'X-GitHub-Api-Version': config.version
        }
    })
    .then((res) => res.json())
    .catch((err) => {
        res.status(500).send(
            {
                code: 500,
                message: `An error occurred while fetching workflows: ${err.message}`
            } as ResponseMessage
        );
    });

    let workflows = response?.workflows;

    if (!workflows || workflows.length === 0)
        return res.status(404).send(
            {
                code: 404,
                message: 'No workflows found'
            } as ResponseMessage
        );
    
    // Get the file names of the workflows and remove the path and leave only the file name minus the extension
    let fileNames = workflows.map((w: any) => w.path.split('/').pop()?.replace('.yml', ''));

    res.send({
        workflows: fileNames
    });
});

// Search for a specific workflow by name
router.get(`${config.baseUrl}/workflow`, async (req, res) => {
    let { owner, repo, workflow } = req.query as { owner: string, repo: string, workflow: string };

    if (!owner || !repo || !workflow)
        return res.status(400).send(
            {
                code: 400,
                message: 'owner, repo, and workflow are required parameters'
            } as ResponseMessage
        );

    let response = await fetch(`${config.githubApi}/repos/${owner}/${repo}/actions/workflows`, {
        method: 'GET',
        headers: {
            "Authorization": `Bearer ${config.token}`,
            'X-GitHub-Api-Version': config.version
        }
    })
    .then((res) => res.json())
    .catch((err) => {
        res.status(500).send(
            {
                code: 500,
                message: `An error occurred while fetching workflows: ${err.message}`
            } as ResponseMessage
        );
    });

    if (!response) return;

    let workflows = response?.workflows;

    if (!workflows || workflows.length === 0)
        return res.status(404).send(
            {
                code: 404,
                message: 'No workflows found'
            } as ResponseMessage
        );

    const filtered = workflows?.filter((w: any) => w.path.endsWith(`${workflow}.yml`));

    if (!filtered || filtered?.length === 0)
        return res.status(404).send(
            {
                code: 404,
                message: 'Workflow not found'
            } as ResponseMessage
        );
    
    res.send({
        workflow: filtered[0]
    });
});

// Dispatch a workflow with optional inputs
router.post(`${config.baseUrl}/workflow`, async (req, res) => {
    let { owner, repo, workflow_id, ref, inputs } = req.body as { owner: string, repo: string, workflow_id: string | number, ref: string, inputs: any};

    if (!owner || !repo || !workflow_id || !ref) 
        return res.status(400).send(
            {
                code: 400,
                message: 'owner, repo, workflow_id, and ref are required parameters'
            } as ResponseMessage
        );

    inputs = inputs || {};
    let random = crypto.randomBytes(16).toString('hex');
    random = random.replace(/[a-zA-Z]/g, '');
   
    [inputs.id] = [random];

    let response = await fetch(`${config.githubApi}/repos/${owner}/${repo}/actions/workflows/${workflow_id}.yml/dispatches`, {
        method: 'POST',
        headers: {
            "Authorization": `Bearer ${config.token}`,
            'X-GitHub-Api-Version': config.version,
            "Accept": "application/vnd.github+json"
        },
        body: JSON.stringify({
            ref,
            inputs
        })
    })
    .then((res) => res.status)
    .catch((err) => {
        res.status(500).send(
            {
                code: 500,
                message: `An error occurred while dispatching workflow: ${err.message}`
            } as ResponseMessage
        );
    });

    if (!response || response !== 204)
        return res.status(404).send(
            {
                code: 404,
                message: 'No workflows found'
            } as ResponseMessage
        );

    res.status(201).send(
        {
            code: 201,
            message: 'Workflow dispatched',
            id: random
        } as ResponseMessage);
});

// Get the run details for a workflow where the job uuid matches the input uuid
router.get(`${config.baseUrl}/run/details`, async (req, res) => {
    let { owner, repo, workflow, uuid } = req.query as { owner: string, repo: string, workflow: string | number, uuid: string };

    if (!owner || !repo || !workflow)
        return res.status(400).send(
            {
                code: 400,
                message: 'owner, repo, and workflow_id are required parameters'
            } as ResponseMessage
        );

    let response = await fetch(`${config.githubApi}/repos/${owner}/${repo}/actions/workflows/${workflow}/runs`, {
        method: 'GET',
        headers: {
            "Authorization": `Bearer ${config.token}`,
            'X-GitHub-Api-Version': config.version
        }
    })
    .then((res) => res.json())
    .catch((err) => {
        res.status(500).send(
            {
                code: 500,
                message: `An error occurred while fetching workflow status: ${err.message}`
            } as ResponseMessage
        );
    });

    let runs = response?.workflow_runs;

    if (!runs || runs.length === 0)
        return res.status(404).send(
            {
                code: 404,
                message: 'No workflow runs found'
            } as ResponseMessage
        );

    res.send({
        run: runs[0]
    });
});

// Get the status for a specific run
router.get(`${config.baseUrl}/run/status`, async (req, res) => {
    let { owner, repo, run_id } = req.query as { owner: string, repo: string, run_id: string };

    if (!owner || !repo || !run_id)
        return res.status(400).send(
            {
                code: 400,
                message: 'owner, repo, and run_id are required parameters'
            } as ResponseMessage
        );
        
    if (isNaN(Number(run_id)))
        return res.status(400).send(
            {
                code: 400,
                message: 'run_id must be a number'
            } as ResponseMessage
        );

    let response = await fetch(`${config.githubApi}/repos/${owner}/${repo}/actions/runs/${run_id}`, {
        method: 'GET',
        headers: {
            "Authorization": `Bearer ${config.token}`,
            'X-GitHub-Api-Version': config.version
        }
    })
    .then((res) => res.json())
    .catch((err) => {
        res.status(500).send(
            {
                code: 500,
                message: `An error occurred while fetching run status: ${err.message}`
            } as ResponseMessage
        );
    });

    if (!response)
        return res.status(404).send(
            {
                code: 404,
                message: 'Run not found'
            } as ResponseMessage
        );

    res.send({
        response
    });
});

// List the user the token is authenticated as
router.get(`${config.baseUrl}/user`, async (req, res) => {
    let response = await fetch(`${config.githubApi}/user`, {
        method: 'GET',
        headers: {
            "Authorization": `Bearer ${config.token}`,
            'X-GitHub-Api-Version': config.version
        }
    })
    .then((res) => res.json())
    .catch((err) => {
        res.status(500).send(
            {
                code: 500,
                message: `An error occurred while fetching user: ${err.message}`
            } as ResponseMessage
        );
    });

    if (!response)
        return res.status(404).send(
            {
                code: 404,
                message: 'User not found'
            } as ResponseMessage
        );

    res.send({
        login: response.login
    });
});

// List all public and private repositories for the authenticated user
router.get(`${config.baseUrl}/repositories`, async (req, res) => {
    let response = await fetch(`${config.githubApi}/user/repos?per_page=100`, {
        method: 'GET',
        headers: {
            "Authorization": `Bearer ${config.token}`,
            'X-GitHub-Api-Version': config.version
        }
    })
    .then((res) => res.json())
    .catch((err) => {
        res.status(500).send(
            {
                code: 500,
                message: `An error occurred while fetching repositories: ${err.message}`
            } as ResponseMessage
        );
    });

    if (!response || response.length === 0)
        return res.status(404).send(
            {
                code: 404,
                message: 'No repositories found'
            } as ResponseMessage
        );

    let names = response.map((r: any) => r.full_name);

    res.send({
        repositories: names
    });
});

// Get the inputs for a specific workflow
router.get(`${config.baseUrl}/workflow/inputs`, async (req, res) => {
    let { owner, repo, workflow } = req.query as { owner: string, repo: string, workflow: string };

    if (!owner || !repo || !workflow)
        return res.status(400).send(
            {
                code: 400,
                message: 'owner, repo, and workflow are required parameters'
            } as ResponseMessage
        );
    
    workflow = `.github/workflows/${workflow}.yml`;

    let response = await fetch(`${config.githubApi}/repos/${owner}/${repo}/contents/${workflow}`, {
        method: 'GET',
        headers: {
            "Authorization": `Bearer ${config.token}`,
            'X-GitHub-Api-Version': config.version
        }
    })
    .then((res) => res.json())
    .catch((err) => {
        res.status(500).send(
            {
                code: 500,
                message: `An error occurred while fetching workflow file: ${err.message}`
            } as ResponseMessage
        );
    });

    if (!response)
        return res.status(404).send(
            {
                code: 404,
                message: 'File not found'
            } as ResponseMessage
        );
    try {

        let content = Buffer.from(response.content, 'base64').toString('utf-8');
        let parsed = yaml.parse(content);
        let inputs = parsed.on.workflow_dispatch.inputs || {};
    
        // Reconstruction of the inputs object to include the name of the input
        inputs = Object.keys(inputs).map((key) => {
            return {
                name: key,
                ...inputs[key]
            };
        });

        // Do not send the uuid input
        inputs = inputs.filter((i: any) => i.name !== 'id');
    
        res.send({
            inputs
        });

    } catch (err) {
        res.status(404).send(
            {
                code: 404,
                message: 'No inputs found'
            } as ResponseMessage
        );
    }

});

// Get jobs for a specific run
router.get(`${config.baseUrl}/run/jobs`, async (req, res) => {
    let { owner, repo, workflow, id } = req.query as { owner: string, repo: string, workflow: string, id: string};

    if (!owner || !repo || !workflow || !id)
        return res.status(400).send(
            {
                code: 400,
                message: 'owner, repo, and run_id are required parameters'
            } as ResponseMessage
        );

    let attempts = 0;
    while (attempts < 40) {
        await new Promise(r => setTimeout(r, 1000));
        attempts++;

        let workflows = await fetch(`${config.githubApi}/repos/${owner}/${repo}/actions/workflows/${workflow}.yml/runs`, {
            method: 'GET',
            headers: {
                "Authorization": `Bearer ${config.token}`,
                'X-GitHub-Api-Version': config.version
            }
        })
        .then((res) => res.json())
        .catch((err) => {
            res.status(500).send(
                {
                    code: 500,
                    message: `An error occurred while fetching workflow status: ${err.message}`
                } as ResponseMessage
            );
        });
    
        let runs = workflows?.workflow_runs;
        if (!runs || runs.length === 0)
            return res.status(404).send(
                {
                    code: 404,
                    message: 'No workflow runs found'
                } as ResponseMessage
            );

        let now = new Date();
        let fiveMinutesAgo = new Date(now.getTime() - 5 * 60000);
        runs = runs.filter((r: any) => new Date(r.created_at) > fiveMinutesAgo);

        runs.forEach(async (w: any) => {
             let response = await fetch(`${config.githubApi}/repos/${owner}/${repo}/actions/runs/${w.id}/jobs`, {
                 method: 'GET',
                 headers: {
                     "Authorization": `Bearer ${config.token}`,
                     'X-GitHub-Api-Version': config.version
                 }
             })
             .then((res) => res.json())
             .catch((err) => {
                 res.status(500).send(
                     {
                         code: 500,
                         message: `An error occurred while fetching run jobs: ${err.message}`
                     } as ResponseMessage
                 );
             });

            let jobs = response?.jobs;

            // Loop over each job and each step and log the step name with the corresponding job run id
            let jobSteps: { id: string, steps: string[] }[] = [];
            jobs.forEach((job: any) => {
                let steps = job.steps.map((s: any) => s.name);
                jobSteps.push({
                    id: job.run_id,
                    steps
                });
            });

             // For each jobsteps check if the steps include the input id, if so return the job id
            let job = jobSteps.find((j: any) => j.steps.includes(id));
            if (job) {
                res.send({
                    job_id: job.id
                });
                attempts = 40;
                return;
            }
         });
    }
});

// Cancel a specific run
router.post(`${config.baseUrl}/run/cancel`, async (req, res) => {
    let { owner, repo, run_id } = req.body as { owner: string, repo: string, run_id: string };

    if (!owner || !repo || !run_id)
        return res.status(400).send(
            {
                code: 400,
                message: 'owner, repo, and run_id are required parameters'
            } as ResponseMessage
        );
        
    if (isNaN(Number(run_id)))
        return res.status(400).send(
            {
                code: 400,
                message: 'run_id must be a number'
            } as ResponseMessage
        );

    let response = await fetch(`${config.githubApi}/repos/${owner}/${repo}/actions/runs/${run_id}/cancel`, {
        method: 'POST',
        headers: {
            "Authorization": `Bearer ${config.token}`,
            'X-GitHub-Api-Version': config.version
        }
    })
    .then((res) => res.json())
    .catch((err) => {
        res.status(500).send(
            {
                code: 500,
                message: `An error occurred while cancelling run: ${err.message}`
            } as ResponseMessage
        );
    });

    if (!response) return;

    res.status(200).send(
        {
            code: 200,
            message: 'Run cancelled'
        } as ResponseMessage);
});

// Get logs for a specific run
router.get(`${config.baseUrl}/run/logs`, async (req, res) => {
    let { owner, repo, run_id } = req.query as { owner: string, repo: string, run_id: string };

    if (!owner || !repo || !run_id)
        return res.status(400).send(
            {
                code: 400,
                message: 'owner, repo, and run_id are required parameters'
            } as ResponseMessage
        );
        
    if (isNaN(Number(run_id)))
        return res.status(400).send(
            {
                code: 400,
                message: 'run_id must be a number'
            } as ResponseMessage
        );

    let response = await fetch(`${config.githubApi}/repos/${owner}/${repo}/actions/runs/${run_id}/logs`, {
        method: 'GET',
        headers: {
            "Authorization": `Bearer ${config.token}`,
            'X-GitHub-Api-Version': config.version
        }
    })
    .catch((err) => {
        console.log(err);
        res.status(500).send(
            {
                code: 500,
                message: `An error occurred while fetching run logs: ${err.message}`
            } as ResponseMessage
        );
    });

    if (!response) return;

    // Make a files directory if it doesn't exist
    const dir = path.join(import.meta.dir, '..', 'files');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
    let runDir = path.join(dir, run_id);

    let url = response?.url;
    const filePath = path.join(dir, `${run_id}.zip`);
    const file = fs.createWriteStream(filePath).on('error', (err: any) => {
        return console.error(err);
    });
    http.get(url, function(response) {
       response.pipe(file);

       file.on("finish", () => {
           file.close();
       });

       file.on("close", async () => {
        yauzl.open(filePath, {lazyEntries: true}, function(err: any, zipfile: any) {
            if (err) return console.log(err);
            zipfile.readEntry();
            zipfile.on("entry", function(entry: any) {
                if (/\/$/.test(entry.fileName)) {
                    // Directory file names end with '/'
                    fs.mkdir(path.join(runDir, entry.fileName), { recursive: true }, (err: any) => {
                        if (err) return console.log(err);
                        zipfile.readEntry();
                    });
                } else {
                    // Ensure parent directory exists
                    fs.mkdir(path.join(runDir, path.dirname(entry.fileName)), { recursive: true }, (err: any) => {
                        if (err) return console.log(err);
                        zipfile.openReadStream(entry, function(err: any, readStream: any) {
                            if (err) return console.log(err);
                            readStream.on("end", function() {
                                zipfile.readEntry();
                            });
                            try {
                                readStream.pipe(fs.createWriteStream(path.join(runDir, entry.fileName)));
                            } catch (err) {
                                return console.error(err);
                            }
                        });
                    });
                }
            });
            zipfile.on("end", function() {
                let logs = fs.readdirSync(runDir).filter((f: string) => f.startsWith('0_') && f.endsWith('.txt'));
                let logContent: { name: string, content: string }[] = [];

                for (const log of logs) {
                    const content = fs.readFileSync(path.join(runDir, log), 'utf-8');
                    const name = log.replace('.txt', '').replace('0_', '');
                    logContent.push({ name, content });
                }

                res.send({
                    logs: logContent
                });

                // Delete the zip file and the extracted files
                try {
                    if (fs.existsSync(filePath))
                        fs.unlinkSync(filePath);
                } catch (err) {
                    console.error(err);
                }

                try {
                    if (fs.existsSync(runDir))
                        fs.rmdirSync(runDir, { recursive: true });
                } catch (err) {
                    console.error(err);
                }
            });
        });
       });
    });

});