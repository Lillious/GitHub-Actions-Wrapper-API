import express from 'express';
import cors from 'cors';
const app = express();
const port = process.env.PORT || 8080;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

var corsOptions = {
  origin: function (origin: any, callback: any) {
    callback(null, true)
  }
}

app.use(cors(corsOptions));

// Static path to www
app.use(express.static('www'));

import { router as api } from './routes/api';
app.use(api);

app.use((req, res, next) => {
    res.status(404).send({
        message: 'Not Found'
    });
});

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});