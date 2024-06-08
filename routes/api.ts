import octokit from '../modules/octopkit';
const yauzl = require("yauzl");
import path from 'path';
import http from 'http';
import crypto from 'crypto';
import yaml from 'yaml';
import fs from 'fs';
import express from 'express';
export const router = express.Router();
const baseUri = '/api';
const apiVersion = '2022-11-28';

// Get the status of the API
router.get(`${baseUri}/status`, (req, res) => {
    res.send({
        status: 'OK'
    });
});

// Get all workflows for a repository
router.get(`${baseUri}/workflows`, async (req, res) => {
    let { owner, repo } = req.query as { owner: string, repo: string };

    if (!owner || !repo)
        return res.status(400).send(
            {
                code: 400,
                message: 'owner and repo are required parameters'
            } as ResponseMessage
        );
        
    let response = await octokit.request('GET /repos/{owner}/{repo}/actions/workflows', {
        owner,
        repo,
        headers: {
          'X-GitHub-Api-Version': apiVersion
        }
      }).catch((err) => {
        res.status(500).send(
            {
                code: 500,
                message: `An error occurred while fetching workflows: ${err.message}`
            } as ResponseMessage
        );
    });

    if (!response) return;

    let workflows = response?.data?.workflows;

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
router.get(`${baseUri}/workflow`, async (req, res) => {
    let { owner, repo, workflow } = req.query as { owner: string, repo: string, workflow: string };

    if (!owner || !repo || !workflow)
        return res.status(400).send(
            {
                code: 400,
                message: 'owner, repo, and workflow are required parameters'
            } as ResponseMessage
        );
        
    let response = await octokit.request('GET /repos/{owner}/{repo}/actions/workflows', {
        owner,
        repo,
        headers: {
          'X-GitHub-Api-Version': apiVersion
        }
      })
      .catch((err) => {
        res.status(500).send(
            {
                code: 500,
                message: `An error occurred while fetching workflows: ${err.message}`
            } as ResponseMessage
        );
    });

    if (!response) return;

    let workflows = response?.data?.workflows;

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
router.post(`${baseUri}/workflow`, async (req, res) => {
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

    let response = await octokit.request('POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches', {
        owner,
        repo,
        workflow_id: `${workflow_id}.yml`,
        ref,
        inputs,
        headers: {
          'X-GitHub-Api-Version': apiVersion
        }
      }).catch((err) => {
        res.status(500).send(
            {
                code: 500,
                message: `An error occurred while dispatching workflow: ${err.message}`
            } as ResponseMessage
        );
    });

    if (!response) return;

    res.status(200).send(
        {
            code: 200,
            message: 'Workflow dispatched',
            id: random
        } as ResponseMessage);
});

// Get the run details for a workflow where the job uuid matches the input uuid
router.get(`${baseUri}/run/details`, async (req, res) => {
    let { owner, repo, workflow, uuid } = req.query as { owner: string, repo: string, workflow: string | number, uuid: string };

    if (!owner || !repo || !workflow)
        return res.status(400).send(
            {
                code: 400,
                message: 'owner, repo, and workflow_id are required parameters'
            } as ResponseMessage
        );
        
    let response = await octokit.request('GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs', {
        owner,
        repo,
        workflow_id: `${workflow}.yml`,
        headers: {
          'X-GitHub-Api-Version': apiVersion
        }
      }).catch((err) => {
        res.status(500).send(
            {
                code: 500,
                message: `An error occurred while fetching workflow status: ${err.message}`
            } as ResponseMessage
        );
    });

    if (!response) return;

    let runs = response?.data?.workflow_runs;

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
router.get(`${baseUri}/run/status`, async (req, res) => {
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

    let response = await octokit.request('GET /repos/{owner}/{repo}/actions/runs/{run_id}', {
        owner,
        repo,
        run_id: Number(run_id),
        headers: {
          'X-GitHub-Api-Version': apiVersion
        }
      }).catch((err) => {
        res.status(500).send(
            {
                code: 500,
                message: `An error occurred while fetching run status: ${err.message}`
            } as ResponseMessage
        );
    });

    if (!response) return;

    let run = response?.data;

    if (!run)
        return res.status(404).send(
            {
                code: 404,
                message: 'Run not found'
            } as ResponseMessage
        );

    res.send({
        run
    });
});

// List the user the token is authenticated as
router.get(`${baseUri}/user`, async (req, res) => {
    let response = await octokit.request('GET /user', {
        headers: {
          'X-GitHub-Api-Version': apiVersion
        }
      }).catch((err) => {
        res.status(500).send(
            {
                code: 500,
                message: `An error occurred while fetching user: ${err.message}`
            } as ResponseMessage
        );
    });

    if (!response) return;

    let user = response?.data;

    if (!user)
        return res.status(404).send(
            {
                code: 404,
                message: 'User not found'
            } as ResponseMessage
        );

    res.send({
        login: user.login
    });
});

// List all public and private repositories for the authenticated user
router.get(`${baseUri}/repositories`, async (req, res) => {
    let response = await octokit.request('GET /user/repos?per_page=100', {
        headers: {
          'X-GitHub-Api-Version': apiVersion
        }
      }).catch((err) => {
        res.status(500).send(
            {
                code: 500,
                message: `An error occurred while fetching repositories: ${err.message}`
            } as ResponseMessage
        );
    });

    if (!response) return;

    let repositories = response?.data;

    if (!repositories || repositories.length === 0)
        return res.status(404).send(
            {
                code: 404,
                message: 'No repositories found'
            } as ResponseMessage
        );

    let names = repositories.map((r: any) => r.full_name);

    res.send({
        repositories: names
    });
});

// Get the inputs for a specific workflow
router.get(`${baseUri}/workflow/inputs`, async (req, res) => {
    let { owner, repo, workflow } = req.query as { owner: string, repo: string, workflow: string };

    if (!owner || !repo || !workflow)
        return res.status(400).send(
            {
                code: 400,
                message: 'owner, repo, and workflow are required parameters'
            } as ResponseMessage
        );
    
    workflow = `.github/workflows/${workflow}.yml`;
        
    let response = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
        owner,
        repo,
        path: workflow,
        headers: {
          'X-GitHub-Api-Version': apiVersion,
          'accept': 'application/vnd.github+json'
        }
      }).catch((err) => {
        res.status(500).send(
            {
                code: 500,
                message: `An error occurred while fetching workflow file: ${err.message}`
            } as ResponseMessage
        );
    });

    if (!response) return;

    let data = response?.data as any;

    if (!data)
        return res.status(404).send(
            {
                code: 404,
                message: 'File not found'
            } as ResponseMessage
        );
    try {

        let content = Buffer.from(data.content, 'base64').toString('utf-8');
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

// Get all runs in the last 5 minutes
router.get(`${baseUri}/runs`, async (req, res) => {
    let { owner, repo, workflow } = req.query as { owner: string, repo: string, workflow: string };

    if (!owner || !repo || !workflow)
        return res.status(400).send(
            {
                code: 400,
                message: 'owner, repo, and workflow are required parameters'
            } as ResponseMessage
        );
        
    let response = await octokit.request('GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs', {
        owner,
        repo,
        workflow_id: `${workflow}.yml`,
        headers: {
          'X-GitHub-Api-Version': apiVersion
        }
      }).catch((err) => {
        res.status(500).send(
            {
                code: 500,
                message: `An error occurred while fetching workflow status: ${err.message}`
            } as ResponseMessage
        );
    });

    if (!response) return;

    let runs = response?.data?.workflow_runs;

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

    res.send({
        runs
    });
});

// Get jobs for a specific run
router.get(`${baseUri}/run/jobs`, async (req, res) => {
    let { owner, repo, run_id, id } = req.query as { owner: string, repo: string, run_id: string, id: string};

    if (!owner || !repo || !run_id || !id)
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

    let response = await octokit.request('GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs', {
        owner,
        repo,
        run_id: Number(run_id),
        headers: {
          'X-GitHub-Api-Version': apiVersion
        }
      }).catch((err) => {
        res.status(500).send(
            {
                code: 500,
                message: `An error occurred while fetching run jobs: ${err.message}`
            } as ResponseMessage
        );
    });

    if (!response) return;

    let jobs = response?.data?.jobs

    if (!jobs || jobs.length === 0)
        return res.status(404).send(
            {
                code: 404,
                message: 'No jobs found'
            } as ResponseMessage
        );

    let job = jobs[0];
    let steps = job.steps?.map((s: any) => s.name);
    if (!steps)
        return res.status(404).send(
            {
                code: 404,
                message: 'No steps found'
            } as ResponseMessage
        );
        
    // Filter step name by ${id}
    steps = steps?.filter((s: any) => s.includes(id));
    if (!steps)
        return res.status(404).send(
            {
                code: 404,
                message: 'No steps found'
            } as ResponseMessage
        );
    
    res.send({
        id
    });
});

// Cancel a specific run
router.post(`${baseUri}/run/cancel`, async (req, res) => {
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

    let response = await octokit.request('POST /repos/{owner}/{repo}/actions/runs/{run_id}/force-cancel', {
        owner,
        repo,
        run_id: Number(run_id),
        headers: {
          'X-GitHub-Api-Version': apiVersion
        }
      }).catch((err) => {
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
router.get(`${baseUri}/run/logs`, async (req, res) => {
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

    let response = await octokit.request('GET /repos/{owner}/{repo}/actions/runs/{run_id}/logs', {
        owner,
        repo,
        run_id: Number(run_id),
        headers: {
          'X-GitHub-Api-Version': apiVersion,
          'accept': 'application/vnd.github+json'
        }
      }).catch((err) => {
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
    const file = fs.createWriteStream(filePath);
    http.get(url, function(response) {
       response.pipe(file);

       file.on("finish", () => {
           file.close();
       });

       file.on("close", async () => {
        yauzl.open(filePath, {lazyEntries: true}, function(err: any, zipfile: any) {
            if (err) throw err;
            zipfile.readEntry();
            zipfile.on("entry", function(entry: any) {
                if (/\/$/.test(entry.fileName)) {
                    // Directory file names end with '/'
                    fs.mkdir(path.join(runDir, entry.fileName), { recursive: true }, (err: any) => {
                        if (err) throw err;
                        zipfile.readEntry();
                    });
                } else {
                    // Ensure parent directory exists
                    fs.mkdir(path.join(runDir, path.dirname(entry.fileName)), { recursive: true }, (err: any) => {
                        if (err) throw err;
                        zipfile.openReadStream(entry, function(err: any, readStream: any) {
                            if (err) throw err;
                            readStream.on("end", function() {
                                zipfile.readEntry();
                            });
                            
                            readStream.pipe(fs.createWriteStream(path.join(runDir, entry.fileName)));
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
                fs.unlinkSync(filePath);
                fs.rmdirSync(runDir, { recursive: true });
            });
        });
       });
    });

});