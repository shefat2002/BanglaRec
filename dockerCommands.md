# Docker Commands

### build docker:
```
docker build -t bangla-rec:latest . 
```

### run docker on windows:
```
docker run -p 5000:5000 -v "%cd%\models:/app/models" bangla-rec:latest
```